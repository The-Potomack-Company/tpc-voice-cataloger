---
phase: 22-foundation-tokens
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/ui/tokens/initTheme.ts
  - src/ui/tokens/index.ts
  - src/main.tsx
  - src/ui/__tests__/init-theme.test.ts
autonomous: true
requirements: [TOKENS-02]
tags: [tokens, runtime, dark-mode, vitest, jsdom]

must_haves:
  truths:
    - "src/ui/tokens/initTheme.ts exports initTheme(opts?: InitThemeOpts): () => void with extensible signature for Phase 25 (D-06, D-07, D-08)"
    - "initTheme attaches a matchMedia('change') listener that toggles .tpc-dark on document.documentElement when the OS dark/light preference flips at runtime (D-06)"
    - "initTheme returns a teardown callable that removes the listener — Phase 25's ThemeProvider can supersede cleanly (D-07)"
    - "initTheme is idempotent vs. the inline script: it re-applies the current matchMedia.matches state on call so Plan 02's pre-paint pass and this runtime pass converge (RESEARCH Pattern 4)"
    - "initTheme has SSR/legacy guard: if window or window.matchMedia is unavailable, returns a no-op teardown (RESEARCH Pattern 4)"
    - "src/main.tsx calls initTheme() near the top, BEFORE createRoot() so the listener is attached before React mounts (RESEARCH Example A)"
    - "src/main.tsx HMR dispose hook calls teardownTheme() alongside the existing unsubscribe()"
    - "Phase 22 stays system-pref-only: initTheme does not read localStorage, does not query Supabase, does not ship UI (D-08)"
    - "Vitest unit test in src/ui/__tests__/init-theme.test.ts asserts: (a) class is added when matchMedia matches dark, (b) class is removed when matchMedia matches light, (c) teardown removes the listener so subsequent change events don't toggle (Validation Wave 0 §init-theme.test.ts)"
    - "src/ui/tokens/index.ts barrel re-exports initTheme so consumers import from the stable public API"
  artifacts:
    - path: "src/ui/tokens/initTheme.ts"
      provides: "Runtime dark-mode listener with extensible signature for Phase 25"
      exports: ["initTheme", "InitThemeOpts", "ThemeOverride"]
    - path: "src/ui/tokens/index.ts"
      provides: "Barrel updated to include initTheme alongside palette exports"
      exports: ["initTheme"]
    - path: "src/main.tsx"
      provides: "App entry that calls initTheme() before createRoot(), tears down on HMR"
      contains: "initTheme()"
    - path: "src/ui/__tests__/init-theme.test.ts"
      provides: "Vitest unit test for listener attach/teardown using existing matchMedia mock infrastructure"
      contains: "describe('initTheme'"
  key_links:
    - from: "src/main.tsx"
      to: "src/ui/tokens/initTheme.ts"
      via: "import { initTheme } from \"./ui/tokens\""
      pattern: "import.*initTheme.*from.*ui/tokens"
    - from: "initTheme()"
      to: "html.tpc-dark class"
      via: "matchMedia('change') listener → classList.toggle('tpc-dark', e.matches)"
      pattern: "classList\\.toggle\\(['\"]tpc-dark['\"]"
    - from: "src/main.tsx HMR dispose"
      to: "initTheme teardown"
      via: "stored teardownTheme() call"
      pattern: "teardownTheme\\(\\)"
    - from: "src/ui/__tests__/init-theme.test.ts"
      to: "initTheme()"
      via: "import + Vitest assertions on document.documentElement.classList"
      pattern: "describe\\(['\"]initTheme"
---

<objective>
Add the runtime arm of the dark-mode bootstrap: a small `initTheme()` helper that attaches a `matchMedia('change')` listener, plus the `main.tsx` wiring that calls it once at app boot, plus a jsdom unit test that locks the contract Phase 25 will extend.

This plan runs **in parallel with Plan 02** in Wave 2 — they touch disjoint files (`src/index.css` + `index.html` vs. `src/ui/tokens/initTheme.ts` + `src/ui/tokens/index.ts` + `src/main.tsx` + `src/ui/__tests__/init-theme.test.ts`). The combined effect (`.tpc-dark` flips synchronously on cold load AND live during a session) is verified by Plan 04 + the manual visual smoke before phase verify.

Purpose: Without this plan, the inline script handles cold load only — if a user toggles their OS theme while the page is open, the page stays stale until reload. With this plan, the page re-themes live within one frame.

Output: 2 new files (`src/ui/tokens/initTheme.ts`, `src/ui/__tests__/init-theme.test.ts`), 2 modified files (`src/ui/tokens/index.ts`, `src/main.tsx`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/22-foundation-tokens/22-CONTEXT.md
@.planning/phases/22-foundation-tokens/22-RESEARCH.md
@.planning/phases/22-foundation-tokens/22-01-SUMMARY.md

@src/main.tsx
@src/tests/setup.ts
@src/ui/tokens/index.ts

<interfaces>
<!-- Public API contract this plan establishes for Phase 25 to extend. -->

From src/ui/tokens/initTheme.ts (created by this plan):
```typescript
export type ThemeOverride = 'light' | 'dark' | 'system';
export interface InitThemeOpts { override?: ThemeOverride }
export function initTheme(opts?: InitThemeOpts): () => void;
```

Behavior contract (locked for Phase 25):
- `initTheme()` (no opts) attaches the matchMedia listener, immediately syncs the current state, returns a teardown.
- `initTheme({ override: 'system' })` (or undefined override) behaves the same as no opts.
- `initTheme({ override: 'light' })` / `'dark'` (Phase 25 use): no listener, force class state, teardown is a no-op cleanup.
  Phase 22 implements only the no-opts/system path — but the function signature MUST accept and ignore the opts param so Phase 25 can add behavior without changing call sites.
- The returned teardown is idempotent (calling twice doesn't throw).

From src/ui/tokens/index.ts (extended):
```typescript
export { initTheme } from './initTheme';
export type { InitThemeOpts, ThemeOverride } from './initTheme';
```

From src/tests/setup.ts (existing — DO NOT modify):
```typescript
// Vitest setup file already mocks window.matchMedia globally:
// matchMedia returns { matches: false, addEventListener: () => {}, removeEventListener: () => {}, ... }
// Tests in this plan override window.matchMedia per-test to drive specific scenarios.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write initTheme unit test FIRST (RED), then implement initTheme.ts (GREEN)</name>
  <files>src/ui/tokens/initTheme.ts, src/ui/__tests__/init-theme.test.ts</files>
  <read_first>
    - src/tests/setup.ts (existing matchMedia mock — confirms `addEventListener` and `removeEventListener` are stubbed; tests in this plan replace `window.matchMedia` per-test to drive specific scenarios)
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-06, D-07, D-08 govern the function shape and Phase-25 contract)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Pattern 4 contains the recommended implementation; React StrictMode safety; HMR cleanup pattern; Anti-Pattern §5 — addListener is deprecated)
    - .planning/phases/22-foundation-tokens/22-VALIDATION.md (Wave 0 Requirements §init-theme.test.ts — covers listener attach/teardown via jsdom)
    - tsconfig.app.json (verbatimModuleSyntax: true — type-only imports/exports must use the `type` modifier per RESEARCH Pitfall 5)
  </read_first>
  <behavior>
    Test 1: when matchMedia matches dark on call, document.documentElement gets the .tpc-dark class.
    Test 2: when matchMedia matches light on call, document.documentElement loses the .tpc-dark class (idempotent cleanup of any prior state).
    Test 3: change events on the matchMedia object after init flip the .tpc-dark class accordingly (live runtime update).
    Test 4: calling the returned teardown removes the listener — subsequent change events do NOT flip the class.
    Test 5: when window is undefined or matchMedia is missing, initTheme returns a no-op teardown without throwing.
    Test 6: initTheme accepts an opts object with `override` field without throwing (forward-compat with Phase 25).
  </behavior>
  <action>
**Step 1 (RED):** Create `src/ui/__tests__/init-theme.test.ts` with the following exact content. This test FILE LIVES UNDER `src/ui/__tests__/` (not `src/tests/`) per RESEARCH §"Recommended Project Structure" — co-locates with the module under test, and `src/ui/__tests__/` is included in `tsconfig.app.json` (whereas `src/tests` is excluded), so the test type-checks. The test will fail until Step 2 lands.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initTheme } from "../tokens/initTheme";

type Listener = (e: MediaQueryListEvent) => void;

interface FakeMQL {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: Listener[];
  _emit: (matches: boolean) => void;
}

function makeFakeMatchMedia(initialMatches: boolean): FakeMQL {
  const listeners: Listener[] = [];
  const fake: FakeMQL = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_event: string, fn: Listener) => {
      listeners.push(fn);
    }),
    removeEventListener: vi.fn((_event: string, fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    }),
    _listeners: listeners,
    _emit: (matches: boolean) => {
      fake.matches = matches;
      // Cast to MediaQueryListEvent shape for the listener payload.
      const evt = { matches } as unknown as MediaQueryListEvent;
      for (const fn of listeners) fn(evt);
    },
  };
  return fake;
}

describe("initTheme", () => {
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    document.documentElement.classList.remove("tpc-dark");
  });

  afterEach(() => {
    document.documentElement.classList.remove("tpc-dark");
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("adds .tpc-dark to <html> when system preference is dark on call", () => {
    const mq = makeFakeMatchMedia(true);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme();

    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);
  });

  it("removes .tpc-dark from <html> when system preference is light on call", () => {
    document.documentElement.classList.add("tpc-dark"); // pre-existing state
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme();

    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("flips .tpc-dark live when matchMedia emits a change event", () => {
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    initTheme();
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);

    mq._emit(true);
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);

    mq._emit(false);
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("teardown removes the change listener", () => {
    const mq = makeFakeMatchMedia(false);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    const teardown = initTheme();
    expect(mq.addEventListener).toHaveBeenCalledTimes(1);
    expect(mq._listeners.length).toBe(1);

    teardown();
    expect(mq.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mq._listeners.length).toBe(0);

    // Subsequent emit should not flip the class.
    mq._emit(true);
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("returns a no-op teardown when window.matchMedia is unavailable", () => {
    // @ts-expect-error simulate environment without matchMedia
    window.matchMedia = undefined;

    const teardown = initTheme();
    expect(typeof teardown).toBe("function");
    // Must not throw on call.
    expect(() => teardown()).not.toThrow();
    // No class should have been added.
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(false);
  });

  it("accepts an opts object with override field (forward-compat, Phase 22 ignores it)", () => {
    const mq = makeFakeMatchMedia(true);
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    // Phase 25 will pass override; Phase 22 should accept the call signature.
    const teardown = initTheme({ override: "system" });
    expect(typeof teardown).toBe("function");
    expect(document.documentElement.classList.contains("tpc-dark")).toBe(true);
    teardown();
  });
});
```

**Step 2 (GREEN):** Create `src/ui/tokens/initTheme.ts` with the following exact content (lifted from RESEARCH Pattern 4 with added Phase-22 documentation):

```typescript
/**
 * src/ui/tokens/initTheme.ts
 *
 * Runtime dark-mode listener for Phase 22 (system-pref only).
 *
 * Two-piece bootstrap (per Phase 22 CONTEXT D-07):
 *   1. The inline <script> in index.html does the synchronous pre-paint pass
 *      (mandatory for no-FOUC on cold load).
 *   2. This helper handles runtime live updates — when the OS dark/light
 *      preference flips during a session, .tpc-dark flips on <html>
 *      without a reload.
 *
 * Phase 25 will pass `{ override: 'light' | 'dark' | 'system' }` via opts to
 * apply a user-chosen preference. Phase 22 stays strictly system-pref-only:
 * does NOT read localStorage, does NOT read from Supabase, does NOT ship UI.
 * The opts param is accepted and ignored here so Phase 25 can add behavior
 * without changing call sites.
 */

export type ThemeOverride = "light" | "dark" | "system";

export interface InitThemeOpts {
  override?: ThemeOverride;
}

/**
 * Attach a matchMedia('change') listener that toggles `.tpc-dark` on
 * `document.documentElement` whenever the OS preference changes. Returns
 * a teardown callable that removes the listener.
 *
 * Idempotent: re-applies the current state on call, so it converges with
 * the inline pre-paint script's state. Safe under React StrictMode (the
 * function runs once at module top-level in main.tsx, not inside a
 * component effect).
 */
export function initTheme(_opts: InitThemeOpts = {}): () => void {
  // SSR / legacy webview guard. Returns a no-op teardown so callers can
  // unconditionally store the return value.
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  const apply = (matches: boolean): void => {
    document.documentElement.classList.toggle("tpc-dark", matches);
  };

  // Idempotent re-sync. The inline script in index.html already did this,
  // but running again here ensures correctness if the inline script was
  // skipped (e.g., dev tools blocked it) or if the OS pref changed between
  // HTML parse and this call.
  apply(mq.matches);

  const listener = (e: MediaQueryListEvent): void => apply(e.matches);
  // Use addEventListener('change'), not the deprecated addListener
  // (per RESEARCH Anti-Pattern §5).
  mq.addEventListener("change", listener);

  return () => mq.removeEventListener("change", listener);
}
```

Critical specifics:
- The function signature is `initTheme(_opts: InitThemeOpts = {}): () => void` — the leading underscore on `_opts` signals "intentionally unused in Phase 22" and matches the project's existing convention for ignored params (no ESLint rule will flag it).
- `InitThemeOpts` and `ThemeOverride` are exported as named types so Phase 25 can `import type` them.
- `verbatimModuleSyntax: true` (per tsconfig.app.json) is satisfied: the file has no `import type` statements (no external type imports needed); the exports of `ThemeOverride` and `InitThemeOpts` are runtime exports of types — TypeScript handles this correctly because they're inline `export type` / `export interface` declarations, not re-exports.
- DO NOT add HMR cleanup logic INSIDE `initTheme.ts` — Plan's Task 2 wires HMR cleanup in `main.tsx` next to the existing `unsubscribe()` pattern.
- DO NOT attempt to call `initTheme()` at module-load time inside this file. The caller (`main.tsx`) controls the call site.

After Step 2, the test from Step 1 should go GREEN.
  </action>
  <verify>
    <automated>npm test -- src/ui/__tests__/init-theme.test.ts --run</automated>
    <automated>npx tsc -p tsconfig.app.json --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `src/ui/tokens/initTheme.ts` exists.
    - File `src/ui/__tests__/init-theme.test.ts` exists.
    - `src/ui/tokens/initTheme.ts` exports `initTheme`, `InitThemeOpts`, `ThemeOverride`.
    - `src/ui/tokens/initTheme.ts` uses `addEventListener("change", ...)` (NOT `addListener`).
    - `src/ui/tokens/initTheme.ts` uses `classList.toggle("tpc-dark", matches)` (single source of truth for class manipulation).
    - `src/ui/tokens/initTheme.ts` returns a function that calls `removeEventListener("change", ...)`.
    - `src/ui/tokens/initTheme.ts` has the `if (typeof window === "undefined" || !window.matchMedia)` SSR/legacy guard returning a no-op teardown.
    - `npm test -- src/ui/__tests__/init-theme.test.ts --run` exits 0 with all 6 test cases passing.
    - `npx tsc -p tsconfig.app.json --noEmit` exits 0 (verbatimModuleSyntax compliant).
  </acceptance_criteria>
  <done>The runtime listener helper is implemented and unit-tested. The contract Phase 25 will extend (the `opts.override` parameter and teardown shape) is locked by tests.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire initTheme into main.tsx and update barrel</name>
  <files>src/main.tsx, src/ui/tokens/index.ts</files>
  <read_first>
    - src/main.tsx (current 51 lines — note the existing `unsubscribe = useAuthStore.getState().initialize()` pattern at line 10 and the `import.meta.hot.dispose(() => unsubscribe())` at line 42)
    - src/ui/tokens/index.ts (created by Plan 01 — has the commented-out `// export { initTheme }` placeholder line)
    - .planning/phases/22-foundation-tokens/22-RESEARCH.md (Example A shows the exact main.tsx integration pattern; Example B shows the final barrel shape)
    - .planning/phases/22-foundation-tokens/22-CONTEXT.md (D-06: initTheme called from src/main.tsx; D-07: teardown returned for Phase 25's ThemeProvider; integration points note "before ReactDOM.createRoot()")
  </read_first>
  <action>
**Step 1: Update `src/ui/tokens/index.ts` to export initTheme.**

Add the previously-commented `initTheme` export. The full file content becomes:

```typescript
// src/ui/tokens/index.ts — Phase 22 barrel re-export.
//
// This is the stable public API for src/ui consumers, including the
// future dashboard repo per Phase 22 CONTEXT spec (specifics §"future
// dashboard repo will consume src/ui/ primitives").

export {
  tpcUnifiedLight,
  tpcUnifiedDark,
  fonts,
  radii,
  fontSizes,
  space,
  paletteFor,
} from "./tokens";
export type { TpcUnifiedPalette } from "./tokens";

export { initTheme } from "./initTheme";
export type { InitThemeOpts, ThemeOverride } from "./initTheme";
```

Note the `export type { ... }` form is required by `verbatimModuleSyntax: true` (per RESEARCH Pitfall 5) — type-only re-exports must use the `type` modifier; collapsing into the runtime `export {}` block fails type-check.

**Step 2: Modify `src/main.tsx` to call initTheme() and tear down on HMR.**

Apply these three edits to `src/main.tsx`:

1. Add the import. After the existing `import { trackEvent } from "./services/analytics";` line (line 7), add:
```typescript
import { initTheme } from "./ui/tokens";
```

2. Call `initTheme()` and store its teardown. After the existing line:
```typescript
const unsubscribe = useAuthStore.getState().initialize();
```
INSERT a new line ABOVE it (so `initTheme` runs first, before any auth-side-effect could touch `document.documentElement`):
```typescript
const teardownTheme = initTheme();
```

The block becomes:
```typescript
// Initialize theme listener before React renders (per Phase 22 CONTEXT D-06).
const teardownTheme = initTheme();

// Initialize auth listener before React renders
const unsubscribe = useAuthStore.getState().initialize();
```

3. Update the HMR dispose hook to call `teardownTheme()` alongside `unsubscribe()`. The existing block at the bottom of the file:
```typescript
// Cleanup on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribe());
}
```
becomes:
```typescript
// Cleanup on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribe();
    teardownTheme();
  });
}
```

DO NOT modify any other lines in `main.tsx`. The error capture handlers (`window.addEventListener("error", ...)` and `window.addEventListener("unhandledrejection", ...)`) and the `createRoot(...)` call stay verbatim.

After this task, the runtime listener is live and the HMR cleanup is wired symmetrically with the existing auth pattern.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const m=fs.readFileSync('src/main.tsx','utf8');const i=fs.readFileSync('src/ui/tokens/index.ts','utf8');const need_m=['import { initTheme } from \"./ui/tokens\"','const teardownTheme = initTheme()','teardownTheme()'];for(const s of need_m){if(!m.includes(s)){console.error('main.tsx MISSING: '+s);process.exit(1)}}const need_i=['export { initTheme } from \"./initTheme\"','export type { InitThemeOpts, ThemeOverride }'];for(const s of need_i){if(!i.includes(s)){console.error('index.ts MISSING: '+s);process.exit(2)}}console.log('ok')"</automated>
    <automated>npx tsc -p tsconfig.app.json --noEmit</automated>
    <automated>npm run build</automated>
    <automated>npm test -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `src/ui/tokens/index.ts` contains the literal substring `export { initTheme } from "./initTheme"`.
    - `src/ui/tokens/index.ts` contains the literal substring `export type { InitThemeOpts, ThemeOverride } from "./initTheme"`.
    - `src/main.tsx` contains the literal substring `import { initTheme } from "./ui/tokens"`.
    - `src/main.tsx` contains the literal substring `const teardownTheme = initTheme()`.
    - `src/main.tsx` contains `teardownTheme()` inside the `import.meta.hot.dispose(...)` block.
    - The `initTheme()` call appears BEFORE `createRoot(...)` in the file (line-order check: `grep -n initTheme src/main.tsx` returns a line number lower than `grep -n createRoot src/main.tsx`).
    - `npx tsc -p tsconfig.app.json --noEmit` exits 0.
    - `npm run build` exits 0.
    - Full test suite `npm test -- --run` exits 0 (no regression; the new `init-theme.test.ts` is now green; pwa-manifest test from Plan 01 still green).
  </acceptance_criteria>
  <done>initTheme is exported from the barrel and called from main.tsx before createRoot. HMR teardown is symmetric with the existing unsubscribe pattern. The runtime live-update path is now active in development and production builds.</done>
</task>

</tasks>

<verification>
After both tasks complete:

```bash
# Type-check across the whole app project (covers src/main.tsx, src/ui/tokens/**, src/ui/__tests__/**)
npx tsc -p tsconfig.app.json --noEmit

# All tests pass (includes new init-theme.test.ts and modified pwa-manifest.test.ts from Plan 01)
npm test -- --run

# Production build succeeds
npm run build

# Lint passes (covers TS files in this plan)
npm run lint
```

All four checks must exit 0.

**Manual verification (per VALIDATION.md "Live OS dark/light flip propagates to page within one frame"):**

```bash
npm run dev
```

1. Open http://localhost:5173 in browser.
2. DevTools > Console: `document.documentElement.className` → should be `"tpc"` or `"tpc tpc-dark"` matching current OS preference.
3. Toggle OS dark mode (Windows: Settings > Personalization > Colors; macOS: System Settings > Appearance).
4. Without reloading the page, confirm `document.documentElement.className` flips and surfaces re-theme within one frame.
5. DevTools > Application > Service Workers / Vite HMR: trigger HMR by editing `src/App.tsx` (insert/delete a space). Confirm no console error from `teardownTheme()` (the dispose hook fires cleanly).
</verification>

<success_criteria>
- `src/ui/tokens/initTheme.ts` exports `initTheme`, `InitThemeOpts`, `ThemeOverride` and behaves per the 6-test contract.
- `src/ui/tokens/index.ts` re-exports `initTheme` and its types.
- `src/main.tsx` calls `initTheme()` before any other side-effect-producing line and tears down on HMR.
- `npm test -- src/ui/__tests__/init-theme.test.ts --run` passes 6/6 cases.
- Full `npm test -- --run` passes; `npm run build`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint` all exit 0.
- Manual smoke: live OS dark/light flip propagates to the open page within one frame without reload.
- The `opts.override` parameter is accepted and ignored — Phase 25 can add behavior to the same call site without changing main.tsx.
</success_criteria>

<output>
After completion, create `.planning/phases/22-foundation-tokens/22-03-SUMMARY.md`.
</output>
