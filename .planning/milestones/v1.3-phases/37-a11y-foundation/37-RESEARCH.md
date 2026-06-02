# Phase 37: a11y-foundation - Research

**Researched:** 2026-06-02
**Domain:** Web accessibility (WCAG 2.1 AA) — focus management, ARIA dialogs, touch targets, automated a11y testing in a React 19 + Vite + Vitest/jsdom + Playwright stack
**Confidence:** HIGH (codebase mapping verified by grep/Read at file:line; deps verified on npm registry + slopcheck; ARIA patterns cited from training/APG, flagged where assumed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hand-roll a `useFocusTrap` hook (zero deps, ~80 LOC). No focus-trap-react / Radix / headlessui. Hook handles: initial focus, Tab/Shift+Tab cycling within the modal, Escape-to-close, and focus restoration to the trigger on close.
- **D-02:** Build one shared `<Modal>` primitive (overlay + `role="dialog"` + `aria-modal="true"` + `useFocusTrap`) and migrate all ~7 dialog sites to it rather than dropping the hook into each modal in-place. Sites to migrate: `ConfirmDialog`, `ReturnDialog`, `ItemPeekModal`, `PhotoLightbox`, `MigrationSplash`, plus any `fixed inset-0` dialog overlays in `SessionDetail`/`NewSession`/`ItemList`. `MigrationSplash` already sets `aria-modal` but has no real trap — fold it in.
- **Note (D-02):** transient toasts/indicators (`ErrorToast`, `RecordingToast`, `RecordingIndicator`, `ContinuousModeControlBar`) are NOT modals — do not trap focus on them.
- **D-03:** **Overflow (⋯) menu.** Each row in `SessionTile` / `SessionCard` / `ItemCard` gets an icon-button `⋯` that opens a small menu containing Delete (with room for future row actions). Keyboard- and screen-reader-reachable, 44px target, scales beyond a single action. The existing swipe gesture (`SwipeableRow`) **stays** as a power-user shortcut — the menu is the accessible-equivalent path, not a replacement.
- **D-04:** Delete from the overflow menu reuses the existing `ConfirmDialog` flow (which itself becomes focus-trapped via D-02) — same confirm semantics as swipe-delete today. No new delete logic.
- **D-05:** Use **both** — `jest-axe` for fast per-component axe scans inside the existing Vitest+jsdom suite, and `@axe-core/playwright` for the keyboard-only record→edit→save e2e flow (Playwright already a dep). These are the only two new dev-deps permitted by this phase (test-only, not shipped).
- **D-06:** 44px targets via a shared Tailwind utility (`min-h-11 min-w-11`, expand hit-area with padding rather than ballooning icon glyphs where a larger glyph would look wrong). Apply across action/icon buttons.
- **D-07:** Icon-only buttons get `aria-label` always; add a visible tooltip (title/tooltip pattern) where hover affordance aids sighted users. Planner picks the exact per-button copy.

### Claude's Discretion
- Exact `useFocusTrap` API shape, `<Modal>` prop surface, overflow-menu component (hand-rolled vs reuse of any existing menu pattern), tooltip rendering mechanism, and per-button label/tooltip copy.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope. Additional row actions beyond Delete in the ⋯ menu are out of scope for v1.3; the menu just leaves structural room for them.
</user_constraints>

<phase_requirements>
## Phase Requirements

This phase is sourced from the Codex audit backlog (no formal REQ-IDs in REQUIREMENTS.md, which is v1.2-scoped). The four deliverables map to Codex issues:

| ID | Description | Research Support |
|----|-------------|------------------|
| Codex #33/#34/#48 | Modal focus-trap + `aria-modal` on every modal site | `useFocusTrap` contract (§ Pattern 1); modal inventory (§ Modal Site Inventory); existing focus token A11Y-02 verified at `src/ui/tokens/base.css:170` |
| Codex #46 | 44px minimum touch targets | `min-h-11 min-w-11` (Tailwind 11 = 44px); current targets use `min-h-12` (48px) in several dialogs — see § Touch Targets |
| Codex #49 | Tooltips / `aria-label`s for icon-only buttons | Icon-only audit (§ Icon-Button Audit) — most already labeled; gaps enumerated |
| Codex #32 | Non-swipe delete affordance | Overflow ⋯ menu design (§ Overflow Menu); `dots` icon already in `src/ui/icons.tsx`; reuses existing `onDelete` + `ConfirmDialog` |

**Gate:** axe-core scan clean on representative pages + keyboard-only record→edit→save flow completes.
</phase_requirements>

## Summary

Phase 37 is additive a11y plumbing over an already token-driven, hand-rolled UI. The codebase has **no a11y library** today and all modals are hand-rolled `fixed inset-0` / `createPortal` overlays — so the locked "zero-dep `useFocusTrap` + one shared `<Modal>`" approach (D-01/D-02) fits the existing idiom exactly. The v1.2 focus-ring rule (`box-shadow: 0 0 0 3px var(--accent-wash)`, A11Y-02) already exists at `src/ui/tokens/base.css:170-176` and is reused verbatim — no new ring styling.

The true modal inventory is **five components**, all reached via `createPortal` or `fixed inset-0`: `ConfirmDialog` (8 render sites — most leverage from migrating this one), `ReturnDialog`, `ItemPeekModal` (currently has **no** `role=dialog`/`aria-modal`/Escape — biggest gap), `PhotoLightbox`, and `MigrationSplash` (has `aria-modal` but no real trap). **Critically, the CONTEXT's "plus any `fixed inset-0` dialog overlays in SessionDetail/NewSession/ItemList" resolves to ZERO additional dialogs** — the `fixed inset-0`/`z-50` hits in those files are transient snackbar/bottom-bar patterns (NewSession:327, SessionDetail:772, ItemList:382), which must NOT be focus-trapped (same exclusion rule as toasts).

The icon-button audit found that **the vast majority of icon-only buttons are already labeled** (phase 36 + v1.2 work). A precise scan (icon/svg with no visible text child and no `aria-label`) returned zero genuine gaps in the migrated-modal surfaces; the remaining flagged buttons all carry visible text labels. The planner should still apply a belt-and-suspenders pass when migrating each surface.

Both new dev-deps are verified clean: `jest-axe@10.0.0` and `@axe-core/playwright@4.11.3` (slopcheck `[OK]`, high download counts, reputable maintainers). `jest-axe@10` ships its own TypeScript types — **do not add `@types/jest-axe`** (the registry copy is stale at v3.5.9).

**Primary recommendation:** Build `useFocusTrap` + `<Modal>` first (Wave 1), migrate the 5 modal components onto `<Modal>` (Wave 2, ConfirmDialog first for max fan-out), add the overflow ⋯ menu to the 3 row components reusing existing `onDelete` (Wave 2), apply `min-h-11 min-w-11` + verify aria-labels per-surface, then wire `jest-axe` per-component tests and one `@axe-core/playwright` keyboard e2e (Wave 3). Reuse the existing `dots`/`trash` icons and the A11Y-02 focus token throughout.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Focus trap / keyboard cycling | Browser / Client | — | Pure DOM focus management; React hook over `document.activeElement` + keydown |
| `role=dialog` / `aria-modal` semantics | Browser / Client | — | ARIA markup on client-rendered overlays |
| 44px touch targets | Browser / Client | — | Tailwind utility classes on interactive elements |
| Icon-button `aria-label` + tooltip | Browser / Client | — | Static/derived markup attributes |
| Overflow ⋯ menu + delete affordance | Browser / Client | — | Client UI invoking existing `onDelete` (which already owns the Supabase/Dexie delete) |
| Delete persistence | (unchanged) Backend/Storage | — | Out of scope — D-04 reuses existing delete logic, no new data path |
| axe per-component scan | Test (Vitest/jsdom) | — | `jest-axe` runs in the existing jsdom suite |
| Keyboard e2e flow | Test (Playwright/Chromium) | — | `@axe-core/playwright` against the running dev server |

**Everything in this phase is Browser/Client tier or Test tier. No backend, schema, or auth changes** (confirmed: CONTEXT explicitly excludes `../_workspace/Schema/`).

## Standard Stack

### Core (new dev-deps — test-only, D-05 locks these as the ONLY two)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jest-axe` | `10.0.0` | Per-component axe-core assertions inside Vitest+jsdom (`expect(results).toHaveNoViolations()`) | De-facto standard for component-level a11y assertions; works under Vitest via `expect.extend(toHaveNoViolations)`. `[VERIFIED: npm registry]` (slopcheck OK, ~1.66M dl/wk) |
| `@axe-core/playwright` | `4.11.3` | Inject + run axe on a live page in Playwright e2e (`new AxeBuilder({ page }).analyze()`) | Official axe-core Playwright integration; Playwright already a dep. `[VERIFIED: npm registry]` (slopcheck OK, ~4.4M dl/wk) |

**Transitive:** `jest-axe@10` bundles `axe-core@4.10.2` (`[VERIFIED: npm registry]` — `npm view jest-axe dependencies.axe-core`). No separate axe-core install needed.

**Do NOT install:**
- `@types/jest-axe` — stale at `3.5.9`; `jest-axe@10` ships its own types (`npm view jest-axe` shows bundled types). Adding the DefinitelyTyped stub would shadow the real types and break against the v10 API. `[VERIFIED: npm registry]`
- Any focus-trap library (`focus-trap-react`, `@radix-ui/*`, `react-focus-lock`, `headlessui`) — explicitly forbidden by D-01.

### Supporting (already present — reuse, do not add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/user-event` | `14.6.1` | Keyboard simulation (`user.tab()`, `user.keyboard('{Escape}')`) for focus-trap unit tests | Per-component trap tests |
| `@playwright/test` | `1.60.0` | e2e runner; `page.keyboard.press('Tab')` for keyboard-only flow | The record→edit→save keyboard gate |
| `react-dom` `createPortal` | `19.2.0` | Existing modal portal mechanism — `<Modal>` should keep portaling to `document.body` | All migrated modals |
| `src/ui/icons.tsx` `<Icon>` | local | `dots` (⋯ trigger) and `trash` (delete item) glyphs already exist | Overflow menu |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `useFocusTrap` (D-01) | `focus-trap-react` | Locked OUT by D-01 (no-new-deps guardrail). Hand-roll is ~80 LOC and the repo already hand-rolls every overlay. |
| Native HTML `<dialog>` element | — | `<dialog>` gives free focus trap + `::backdrop`, but would require rewriting all 5 overlays away from the `fixed inset-0` idiom and loses fine control over the existing token-driven scrim. Not recommended for this phase; flagged as future simplification. `[ASSUMED]` |
| `jest-axe` per-component | only `@axe-core/playwright` e2e | D-05 locks both; per-component scans are faster and pin violations to a component, e2e covers integrated keyboard flow. Use both. |

**Installation:**
```bash
npm install -D jest-axe@10 @axe-core/playwright@4
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `jest-axe` | npm | published 10.0.0 2025-03-03 | ~1.66M/wk | github.com/nickcolley/jest-axe (maintainer nickcolley) | [OK] | Approved |
| `@axe-core/playwright` | npm | published 4.11.3 2026-06-01 | ~4.4M/wk | github.com/dequelabs/axe-core-npm (Deque) | [OK] | Approved |
| `axe-core` (transitive of jest-axe) | npm | 4.10.2 | (transitive) | github.com/dequelabs/axe-core | [OK] | Approved (bundled, no direct install) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck v0.6.1 ran successfully and rated both `[OK]`. No `postinstall` red flags. Both are test-only (`-D`) and never shipped to the client bundle.

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────────────────────┐
  trigger button (focus) ──►│  open state (component-owned, unchanged)     │
                            └───────────────────┬─────────────────────────┘
                                                │ open=true
                                                ▼
                    ┌───────────────────────────────────────────────┐
                    │  <Modal>  (NEW shared primitive)               │
                    │  • createPortal → document.body                │
                    │  • fixed inset-0 z-50 scrim (token-driven)     │
                    │  • role="dialog" aria-modal="true"             │
                    │  • useFocusTrap(panelRef, { onClose })  ───┐   │
                    └────────────────────────────────────────────┼───┘
                                                                  │
                          ┌───────────────────────────────────────┘
                          ▼  useFocusTrap (NEW hook)
              ┌──────────────────────────────────────────────────┐
              │ on mount:  save document.activeElement (trigger)  │
              │            focus first focusable in panel         │
              │ on keydown Tab/Shift+Tab: cycle within focusables │
              │ on keydown Escape: call onClose                   │
              │ on unmount: restore focus to saved trigger        │
              └──────────────────────────────────────────────────┘
                          │  wraps body of each migrated modal
                          ▼
   ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
   │ConfirmDialog │ ReturnDialog │ ItemPeekModal│ PhotoLightbox│ MigrationSplash│
   │ (8 sites)    │              │ (+role/esc)  │              │ (fold-in trap) │
   └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

   ─── EXCLUDED (role=alert / live-region, NEVER trapped) ───
   ErrorToast · RecordingToast · RecordingIndicator · ContinuousModeControlBar
   + transient bars: NewSession:327, SessionDetail:772, ItemList:382 (snackbars/bottom-bar)

   ─── Overflow delete affordance (parallel to swipe) ───
   SessionTile / SessionCard / ItemCard
        ├─ existing SwipeableRow (KEPT — power-user shortcut) ─► onDelete
        └─ NEW ⋯ icon-button (44px, aria-label) ─► menu ─► Delete ─► same onDelete ─► ConfirmDialog
```

### Recommended Project Structure
```
src/
├── hooks/
│   └── useFocusTrap.ts          # NEW (D-01) — zero-dep trap hook
├── ui/
│   ├── Modal.tsx                # NEW (D-02) — shared dialog primitive
│   └── OverflowMenu.tsx         # NEW (D-03) — ⋯ trigger + menu (or co-locate per row)
├── components/
│   ├── ConfirmDialog.tsx        # MIGRATE → wrap body in <Modal>
│   ├── ReturnDialog.tsx         # MIGRATE → <Modal>
│   ├── ItemPeekModal.tsx        # MIGRATE → <Modal> (gains role/aria-modal/Escape)
│   ├── PhotoLightbox.tsx        # MIGRATE → <Modal> (preserve swipe nav + nested ConfirmDialog)
│   ├── MigrationSplash.tsx      # MIGRATE → fold real trap in (already has aria-modal)
│   ├── SessionTile.tsx          # ADD ⋯ menu
│   ├── SessionCard.tsx          # ADD ⋯ menu
│   └── ItemCard.tsx             # ADD ⋯ menu
└── tests/
    └── a11y/                    # NEW — jest-axe per-component scans
tests/e2e/
    └── keyboard-flow.spec.ts    # NEW — @axe-core/playwright record→edit→save
```

### Pattern 1: `useFocusTrap` contract (D-01)

**What:** A zero-dep hook owning initial focus, Tab/Shift+Tab wrap, Escape, and restore-on-unmount.
**When to use:** Inside `<Modal>` only (not on toasts).

**Focusable selector set** (the canonical APG selector — `[ASSUMED]` from training/WAI-ARIA APG, verify against the panel's real content):
```
a[href], button:not([disabled]), textarea:not([disabled]),
input:not([disabled]), select:not([disabled]),
[tabindex]:not([tabindex="-1"])
```
Filter to visible elements (`offsetParent !== null` or not `aria-hidden`).

**Contract (the load-bearing behaviors):**

| Behavior | Implementation note |
|----------|--------------------|
| **Initial focus** | On mount, `panelRef.current.querySelector(SELECTOR)?.focus()`. If a primary action exists prefer it; ConfirmDialog default-focuses the confirm/cancel. Fallback: focus the panel itself (`tabIndex={-1}`). |
| **Tab / Shift+Tab wrap** | On `keydown` Tab: if `activeElement === last` → focus first + `preventDefault`. Shift+Tab: if `activeElement === first` → focus last. Recompute focusables on each keydown (content can change — e.g. ReturnDialog textarea). |
| **Escape closes** | `keydown` Escape → `onClose()`. Match existing semantics: PhotoLightbox/ItemPeekModal currently close on button only; Escape is new. For ConfirmDialog, Escape === cancel (non-destructive). |
| **Focus restore** | Save `document.activeElement` in a ref on mount; on unmount/close, `savedEl?.focus()`. Guard against the trigger being unmounted (null check). |
| **Reduced motion (MOTION-04)** | Any open/close transition the `<Modal>` adds must respect `prefers-reduced-motion: reduce` → instant, no animated reveal. Existing pattern in repo: `window.matchMedia("(prefers-reduced-motion: reduce)").matches` (see `src/ui/Waveform.tsx:24`, `src/hooks/useAudioRecorder.ts:97`). MigrationSplash currently animates opacity (`transition-opacity duration-300`) — gate that behind the reduced-motion check when folding in. |

**Existing focus-ring token (v1.2 A11Y-02) — reuse verbatim, author NO new ring:**
```css
/* Source: src/ui/tokens/base.css:170-176  [VERIFIED: codebase] */
.tpc .tpc-btn:focus-visible,
.tpc .tpc-card-interactive:focus-visible,
.tpc .tpc-badge[role="button"]:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-wash);
}
/* --accent-wash defined at docs/design-handoff/tpc-unified-tokens.css:41 (light) / :90 (dark) */
```
Inputs use the sibling rule `.tpc .tpc-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-wash); }` at `src/ui/tokens/base.css:108`. **There is no generic `*:focus-visible` rule** — focus rings are class-scoped to `.tpc-btn` / `.tpc-input` / `.tpc-card-interactive` / `.tpc-tab`. New focusable elements (overflow-menu items) must carry one of these classes (or replicate the box-shadow) to get a visible ring. `[VERIFIED: codebase]`

### Pattern 2: `<Modal>` primitive (D-02)

**What:** Overlay + scrim + `role=dialog` + `aria-modal` + `useFocusTrap`, portaled to body.
**Prop surface (suggested — Claude's discretion):** `{ open, onClose, labelledBy?/ariaLabel, children, initialFocusRef? }`. Keep portaling to `document.body` (matches ConfirmDialog/ReturnDialog/MigrationSplash today).
**Scrim:** reuse existing idiom — `fixed inset-0 z-50` + token scrim. Existing scrims vary (`bg-black/50` on ConfirmDialog/ReturnDialog `src/components/ConfirmDialog.tsx:27`, `bg-ink/40` on ItemPeekModal:26, opaque `bg-white dark:bg-gray-900` on MigrationSplash:78). UI-SPEC says use `--bg-3` reduced-opacity scrim; standardize on the token scrim but **preserve MigrationSplash's opaque full-screen splash look** (it's a splash, not a centered dialog).
**Title association:** prefer `aria-labelledby` pointing at the modal `<h2>/<h3>` over `aria-label` where a visible heading exists (ConfirmDialog/ReturnDialog/ItemPeekModal all have headings). `[ASSUMED]` — APG dialog pattern.

### Pattern 3: Overflow ⋯ menu (D-03/D-04)

**What:** Icon-button `⋯` (use `<Icon name="dots" />` — already in `src/ui/icons.tsx`) opening a small menu with Delete.
**Mount points (verified file:line):**
- `SessionTile.tsx` — header region inside the `SwipeableRow` body, around `src/components/SessionTile.tsx:107-201`.
- `SessionCard.tsx` — `src/components/SessionCard.tsx:107-168` (admin/sale variant of the tile).
- `ItemCard.tsx` — header/grid, `src/components/ItemCard.tsx:88` wraps in `SwipeableRow`; existing inline delete trigger already exists at `:280` and `:392` (`onClick={() => setShowDeleteConfirm(true)}`). **Wire the menu's Delete to the same setter** — ItemCard already owns its ConfirmDialog at `:402`.
**Delete wiring (no new logic, D-04):**
- `ItemCard`: menu Delete → `setShowDeleteConfirm(true)` (its local `ConfirmDialog` at `:402` is already there). `[VERIFIED: codebase]`
- `SessionTile` / `SessionCard`: both take an `onDelete: () => void` prop (`SessionTile.tsx:29`, `SessionCard.tsx:14`) currently passed only to `SwipeableRow`. Menu Delete → call the same `onDelete`. The parent (`Sessions.tsx:596` ConfirmDialog) owns the confirm dialog. `[VERIFIED: codebase]`
**A11y of the menu (APG menu-button pattern, `[ASSUMED]`):** trigger `aria-haspopup="menu"` + `aria-expanded`; menu items reachable by keyboard; Escape closes menu and restores focus to the ⋯ trigger; Delete item uses `--err` ink (UI-SPEC). Honor `prefers-reduced-motion` for any open/close transition (MOTION-04). Menu items need a focus ring — give them `tpc-btn`/`tpc-card-interactive` class or replicate the box-shadow (no generic focus-visible exists).

### Anti-Patterns to Avoid
- **Trapping focus on toasts/bars:** Do NOT add `useFocusTrap`/`role=dialog` to `ErrorToast` (`role="alert"`, `src/components/ErrorToast.tsx`), `RecordingToast`, `RecordingIndicator`, `ContinuousModeControlBar`, or the transient bars at `NewSession.tsx:327` / `SessionDetail.tsx:772` / `ItemList.tsx:382`. These are live-regions/snackbars and trapping them would strand the user.
- **Re-implementing delete:** D-04 forbids new delete logic — route everything through existing `onDelete` / `setShowDeleteConfirm` + the existing `ConfirmDialog`.
- **Adding a new focus-ring style:** A11Y-02 ring already exists; new focusables must adopt it, not invent one.
- **Removing the swipe gesture:** D-03 keeps `SwipeableRow` as a power-user shortcut.
- **Ballooning icon glyphs to hit 44px:** D-06 — grow hit-area with padding, keep glyph size.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| axe rule engine | custom contrast/role checker | `jest-axe` + `@axe-core/playwright` | Deque maintains 90+ rules; rolling your own misses 95% of violations |
| Focus trap | (this one IS hand-rolled per D-01) | — | Explicit exception: D-01 locks the hand-roll. ~80 LOC is tractable; libraries forbidden by guardrail. |
| Portal/overlay | new overlay system | existing `createPortal` to `document.body` | Already the repo idiom (ConfirmDialog/ReturnDialog/MigrationSplash) |
| Icon set | new ⋯/trash SVGs | `<Icon name="dots" />` / `<Icon name="trash" />` | Both already in `src/ui/icons.tsx` |
| Focus ring | new CSS | A11Y-02 token rule at `src/ui/tokens/base.css:170` | Shipped in v1.2 |

**Key insight:** Almost everything except `useFocusTrap`, `<Modal>`, and the ⋯ menu already exists in the repo — this phase is mostly wiring existing primitives, not net-new infra.

## Modal Site Inventory (deliverable (a))

> The exhaustive list the planner needs. Five real modal components; eight ConfirmDialog render sites.

### Migrate onto `<Modal>` (true dialogs)

| Component | File | Current ARIA state | Gap to close |
|-----------|------|--------------------|--------------|
| `ConfirmDialog` | `src/components/ConfirmDialog.tsx:27` | `createPortal`, `bg-black/50` scrim, NO role/aria-modal/trap/Escape | Wrap body in `<Modal>` — **highest leverage** (8 render sites inherit the fix) |
| `ReturnDialog` | `src/components/ReturnDialog.tsx:32` | `createPortal`, `bg-black/50`, NO role/aria-modal/trap/Escape; has a `<textarea>` (initial-focus candidate) | Wrap in `<Modal>` |
| `ItemPeekModal` | `src/components/ItemPeekModal.tsx:26` | `fixed inset-0 z-[60]`, NO role, NO aria-modal, **NO Escape** (close button only) | **Biggest single gap** — gains role/aria-modal/trap/Escape via `<Modal>` |
| `PhotoLightbox` | `src/components/PhotoLightbox.tsx:113` | `fixed inset-0 z-50`, NO role/aria-modal/trap; has swipe nav + **nested `ConfirmDialog` at :159** | Wrap in `<Modal>`; keep touch swipe nav (`onTouchStart/End`); nested ConfirmDialog also becomes trapped — verify nested-trap behavior (inner dialog should own focus while open) |
| `MigrationSplash` | `src/components/MigrationSplash.tsx:78` | `createPortal`, **already has `role="dialog"` + `aria-modal="true"`** (`:81-82`) but NO real trap; auto-dismisses; animates opacity | Fold real trap in; gate opacity transition behind reduced-motion. Note: it's a splash (opaque full-screen), keep that look |

### ConfirmDialog render sites (all inherit the trap once ConfirmDialog is migrated — verified file:line)

| Site | File:line | Notes |
|------|-----------|-------|
| Account deactivate | `src/pages/AccountManagement.tsx:286` | |
| Item delete | `src/components/ItemCard.tsx:402` | overflow ⋯ Delete target (D-04) |
| (ItemList) | `src/components/ItemList.tsx:407` | |
| New session discard | `src/pages/NewSession.tsx:333` | |
| Settings | `src/pages/Settings.tsx:289` | |
| Session delete | `src/pages/Sessions.tsx:596` | overflow ⋯ Delete target for SessionTile/Card (D-04) |
| Photo delete (nested) | `src/components/PhotoLightbox.tsx:159` | nested inside a modal |
| Session submit/export/reopen/delete (×4) | `src/pages/SessionDetail.tsx:683,694,705,716` | one component, four states |

### EXCLUDED — never trap (deliverable (a), toast exclusion)

| Component | File | Why excluded |
|-----------|------|--------------|
| `ErrorToast` | `src/components/ErrorToast.tsx` | `role="alert"` live-region (phase 36); its `aria-label="Dismiss"` is the label-copy reference pattern |
| `RecordingToast` | `src/components/RecordingToast.tsx` | transient indicator |
| `RecordingIndicator` | `src/components/RecordingIndicator.tsx:17` | `fixed inset-0 pointer-events-none` border pulse — decorative, never focusable |
| `ContinuousModeControlBar` | `src/components/ContinuousModeControlBar.tsx` | persistent control bar |
| Snackbar | `src/pages/NewSession.tsx:327` | `fixed bottom-24` toast — transient, not a dialog |
| Snackbar | `src/pages/SessionDetail.tsx:772` | `fixed bottom-24` toast |
| Bottom action bar | `src/components/ItemList.tsx:382` | `fixed bottom-0` selection bar, not a dialog |

**Finding:** the CONTEXT's "plus any `fixed inset-0` dialog overlays in SessionDetail/NewSession/ItemList" resolves to **none** — the only `fixed inset-0`/`z-50` overlays in those files are the three transient bars above. No hidden 6th/7th dialog exists. `Walkthrough.tsx` / `src/components/walkthrough/*` have **no** `fixed inset-0` / `role=dialog` / `aria-modal` overlay (grep returned nothing) — the only `createPortal` users are ConfirmDialog, ReturnDialog, MigrationSplash. `[VERIFIED: codebase]`

## Touch Targets (deliverable, D-06 / Codex #46)

- Tailwind `min-h-11 min-w-11` = `2.75rem` = **44px** (Tailwind scale `11`). `[VERIFIED: training]` Tailwind 4 retains the 4px base scale; `11 × 0.25rem = 2.75rem`. Confirm against the project's Tailwind config (default scale, no override observed).
- **Current state:** several dialog buttons already use `min-h-12` (48px) — `ConfirmDialog.tsx:37,44`, `ReturnDialog.tsx:51,58`, `MigrationSplash.tsx:114,121`. PhotoLightbox close/trash use `min-w-12 min-h-12` (`:124,:136`). These already exceed 44px — leave them or normalize. The gaps are **icon-only buttons in row/header chrome** (the ⋯ trigger must be 44px; existing small icon buttons like `ItemPeekModal.tsx:35` close use `padding:6` on a 16px glyph → ~28px, below 44px).
- Apply the utility to: the new ⋯ trigger, overflow-menu items, and any sub-44px icon-only button surfaced during migration. Grow via padding, not glyph size.

## Icon-Button Audit (deliverable (d), D-07 / Codex #49)

**Method:** node scan of every `<button>`/`<Button>` containing `<Icon>`/`<svg>`, filtered to those with NO visible text child AND NO `aria-label`/`aria-labelledby` on the opening tag.

**Result: zero genuine unlabeled icon-only buttons remain.** Most were labeled in phase 36 / v1.2. Already-labeled icon-only buttons (reference patterns):
- `ErrorToast.tsx:50` — `aria-label="Dismiss"` (the canonical verb-noun pattern to reuse)
- `SessionSearch.tsx:55` — `aria-label="Clear search"`
- `ItemPeekModal.tsx:35` — `aria-label="Close item preview"`
- `PhotoLightbox.tsx:120` — `aria-label="Close"`; `:132` — `aria-label="Delete photo"`
- `ItemEntry.tsx:448` — labeled
- `WarnBanner.tsx:48` — labeled

**False positives** from a looser scan (these have visible text alongside the icon — do NOT need aria-label): `SessionDetail.tsx:199` ("Back"), `Settings.tsx:182` ("Change Password"), `ItemList.tsx:300` ("Retry all"), `PhotoCapture.tsx:172` (camera w/ text), `Sessions.tsx:177/388` (text), `AiFailureBanner.tsx:62` ("Retry" text).

**Planner action:** The NEW elements this phase introduces are the ones needing labels — the ⋯ trigger (`aria-label="More actions"` per UI-SPEC) and the menu Delete item (visible "Delete" text, so labeled implicitly). Still run a verification pass per migrated surface, but expect near-zero pre-existing gaps. Tooltip mechanism (D-07) is Claude's discretion; tooltip string MUST equal the `aria-label` (UI-SPEC copywriting contract).

## Common Pitfalls

### Pitfall 1: Nested modal focus trap (PhotoLightbox → ConfirmDialog)
**What goes wrong:** PhotoLightbox (`:113`) contains a nested ConfirmDialog (`:159`). If both are `<Modal>` with traps, two traps fight over focus.
**Why:** Both register keydown handlers + claim initial focus.
**How to avoid:** Inner dialog (most recently opened) should own focus; outer trap should yield while a child dialog is open. Simplest: when the nested ConfirmDialog opens, the outer lightbox trap is still mounted but the inner trap's initial-focus + Escape take precedence (last-mounted handler wins, or scope by checking `event.target` containment). Test this explicitly.

### Pitfall 2: Recomputing focusables when modal content changes
**What goes wrong:** Trap caches focusables on mount; ReturnDialog's textarea or a conditionally-rendered button (MigrationSplash error-state buttons at `:111-124`) isn't in the cache → Tab escapes the trap.
**How to avoid:** Query focusables on each Tab keydown, not once on mount.

### Pitfall 3: jsdom can't compute layout → axe false negatives/positives
**What goes wrong:** `jest-axe` under jsdom can't evaluate color-contrast (no layout/paint) and some visibility rules; contrast is already covered by v1.2's `contrast.test.ts`.
**How to avoid:** Disable rules jsdom can't evaluate in per-component scans (`axe(container, { rules: { 'color-contrast': { enabled: false } } })`) and rely on `@axe-core/playwright` (real browser) for contrast/visibility. `[ASSUMED]` — standard jest-axe+jsdom guidance; verify rule IDs.

### Pitfall 4: Restoring focus to an unmounted trigger
**What goes wrong:** Modal closes after the triggering row was deleted (delete flow!) → saved trigger element is gone → `.focus()` throws or focus lands on `<body>`.
**How to avoid:** Null-check the saved element and its `isConnected`; fall back to a sensible container (e.g. the list) if the trigger is gone. Especially relevant for the overflow-delete path.

### Pitfall 5: matchMedia in jsdom tests
**What goes wrong:** Reduced-motion check (`window.matchMedia`) — jsdom's matchMedia is mocked to always return `matches:false` in `src/tests/setup.ts`. Reduced-motion branch won't be exercised by default.
**How to avoid:** Per-test, override `window.matchMedia` to return `matches:true` when testing the reduced-motion path (the setup mock is overridable). `[VERIFIED: codebase]` — see `src/tests/setup.ts`.

## Code Examples

### jest-axe under Vitest
```ts
// Source: jest-axe README pattern, adapted for Vitest  [ASSUMED — verify expect.extend wiring]
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { expect, test } from "vitest";

expect.extend(toHaveNoViolations);

test("ConfirmDialog has no a11y violations", async () => {
  const { container } = render(
    <ConfirmDialog open title="Delete" message="Sure?" onConfirm={() => {}} onCancel={() => {}} />
  );
  const results = await axe(container, {
    rules: { "color-contrast": { enabled: false } }, // jsdom can't paint
  });
  expect(results).toHaveNoViolations();
});
```
Note: `<Modal>` portals to `document.body`; pass `document.body` (or `baseElement` from RTL) to `axe()` so the portaled content is scanned, not the empty `container`.

### @axe-core/playwright keyboard flow
```ts
// Source: @axe-core/playwright README pattern  [ASSUMED — verify AxeBuilder import]
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("keyboard-only record→edit→save, axe clean", async ({ page }) => {
  await page.goto("/");
  // drive the flow with keyboard only
  await page.keyboard.press("Tab");
  // ... navigate to record, edit a field, save — assert focus order + reachability
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```
Auth: existing `playwright.config.ts` gates protected routes behind a `SUPABASE_URL` presence check (`playwright.config.ts` comment) — the keyboard flow may need a signed-in session or to target the login + an unauthenticated-reachable surface. Coordinate with the existing `tests/e2e/visual-smoke.spec.ts` auth approach.

### Existing reduced-motion check (reuse this idiom)
```ts
// Source: src/ui/Waveform.tsx:24, src/hooks/useAudioRecorder.ts:97  [VERIFIED: codebase]
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

## Runtime State Inventory

> This is a pure-UI/code phase. No rename, no migration, no datastore keys.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB keys, collections, or IDs touched. Delete reuses existing `onDelete`/Supabase paths unchanged (D-04). | none |
| Live service config | None — no external service config. | none |
| OS-registered state | None. | none |
| Secrets/env vars | None. Playwright e2e reads existing `SUPABASE_URL` gate (read-only, already present). | none |
| Build artifacts | None — two test-only dev-deps added to `package.json`/`package-lock.json`; no compiled artifacts carry old names. | `npm install` after merge |

**Verified:** CONTEXT explicitly states no schema/auth/data changes; grep confirms delete flows route through existing handlers.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@types/jest-axe` separate install | `jest-axe` ships own types | jest-axe ≥ v6 era | Do NOT install `@types/jest-axe` (stale v3.5.9) |
| Manual focus management per modal | one `<Modal>` + `useFocusTrap` | this phase | Centralizes trap; 5 modals + 8 ConfirmDialog sites fixed at once |
| Swipe-only delete | swipe + accessible ⋯ menu | this phase (D-03) | Keyboard/SR users can delete |

**Deprecated/outdated:** Native `<dialog>` is now well-supported and would give a free trap, but adopting it is OUT of scope (would require rewriting all overlays; D-01 locks the hand-roll). Flag as a future simplification only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | APG focusable-selector set is the right query | Pattern 1 | Some focusable elements missed/over-included; mitigated by per-keydown recompute + tests |
| A2 | `aria-labelledby` → heading is preferred over `aria-label` for these dialogs | Pattern 2 | Minor SR verbosity difference; both valid |
| A3 | Disabling `color-contrast` rule in jest-axe is correct (jsdom can't paint) | Pitfall 3 | If left on, false reports; contrast already covered by v1.2 contrast.test.ts + Playwright |
| A4 | `expect.extend(toHaveNoViolations)` works under Vitest as under Jest | Code Examples | Wiring may differ slightly; verify on first test |
| A5 | `AxeBuilder` default import path `@axe-core/playwright` | Code Examples | Import may be named; verify against installed package |
| A6 | Tailwind `11` = 44px holds (no custom scale override) | Touch Targets | If scale overridden, 44px utility differs; check tailwind config |
| A7 | Native `<dialog>` rewrite is out of scope | State of the Art | None — explicitly deferred |
| A8 | Menu-button APG pattern (`aria-haspopup="menu"`, `aria-expanded`) for ⋯ menu | Pattern 3 | SR announcement differs if wrong roles; low risk |

**Confirm A4/A5 on the first written test** — they gate all jest-axe/Playwright wiring.

## Open Questions

1. **Keyboard e2e auth path**
   - What we know: `playwright.config.ts` gates protected routes behind `SUPABASE_URL`; existing smoke spec runs login + theme toggle without creds.
   - What's unclear: whether the record→edit→save flow needs an authenticated session fixture or can run against a seeded/mock state.
   - Recommendation: planner decides — either add a storage-state auth fixture (matching `tests/e2e/visual-smoke.spec.ts`) or scope the keyboard gate to the deepest unauthenticated-reachable surface plus per-component jest-axe for the authed screens.

2. **Nested-modal trap behavior (PhotoLightbox + ConfirmDialog)**
   - What we know: lightbox embeds a ConfirmDialog; both will be `<Modal>`.
   - Recommendation: explicit test that opening the inner confirm moves focus into it and Escape returns to the lightbox, not all the way out.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | v24.15.0 | — |
| Vitest + jsdom | jest-axe per-component | ✓ | vitest 4.0.18 / jsdom 28.1.0 | — |
| @testing-library/* | trap unit tests | ✓ | react 16.3.2 / user-event 14.6.1 | — |
| Playwright + Chromium | keyboard e2e | ✓ (config present) | @playwright/test 1.60.0 | — |
| `jest-axe` | per-component axe | ✗ (to install) | 10.0.0 | none — must install (D-05) |
| `@axe-core/playwright` | e2e axe | ✗ (to install) | 4.11.3 | none — must install (D-05) |
| Dev server (https://localhost:5173) | e2e webServer | ✓ (playwright auto-starts via `npm run dev`) | — | — |

**Missing dependencies with no fallback:** the two locked dev-deps — installed via `npm install -D jest-axe@10 @axe-core/playwright@4`. Both verified clean (Package Legitimacy Audit).

## Validation Architecture

> nyquist_validation is enabled (config `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (jsdom) for unit/component; Playwright 1.60.0 (Chromium) for e2e |
| Config file | `vite.config.ts` (`test` block, setup `src/tests/setup.ts`); `playwright.config.ts` (`testDir: ./tests/e2e`) |
| Quick run command | `npm test -- <pattern>` (e.g. `npm test -- a11y`) |
| Full suite command | `npm test` (= `vitest --run`) + `npx playwright test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| #33/#48 focus-trap | initial focus + Tab/Shift+Tab wrap + Escape + restore | unit | `npm test -- useFocusTrap` | ❌ Wave 0 |
| #33/#48 modal | each modal renders `role=dialog`+`aria-modal`, traps, no axe violations | component | `npm test -- a11y/modals` | ❌ Wave 0 |
| #46 touch targets | ⋯ trigger + icon buttons ≥44px box | component | `npm test -- a11y/touch-targets` (assert min-h-11/min-w-11 class or computed box) | ❌ Wave 0 |
| #49 icon labels | every icon-only button has accessible name (jest-axe `button-name` rule) | component | `npm test -- a11y` | ❌ Wave 0 |
| #32 overflow delete | ⋯ menu keyboard-openable, Delete → ConfirmDialog → onDelete called | component | `npm test -- overflow-menu` | ❌ Wave 0 |
| Gate | keyboard-only record→edit→save, axe clean | e2e | `npx playwright test keyboard-flow` | ❌ Wave 0 |
| Regression | existing 84 test files still green | full | `npm test` | ✓ (must not regress; SwipeableRow mocks at `session-tile.test.tsx:13`, `session-assignment.test.tsx:22` etc. — overflow-menu addition must not break these mocks) |

### Sampling Rate
- **Per task commit:** `npm test -- <touched-area>` (e.g. the specific a11y spec) — runs in seconds under jsdom.
- **Per wave merge:** `npm test` (full Vitest run, 84 files) + targeted Playwright spec.
- **Phase gate:** full `npm test` green + `npx playwright test keyboard-flow` green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/tests/a11y/use-focus-trap.test.tsx` — covers focus-trap contract (initial/Tab-wrap/Escape/restore) with `@testing-library/user-event`
- [ ] `src/tests/a11y/modals.test.tsx` — jest-axe scan of ConfirmDialog/ReturnDialog/ItemPeekModal/PhotoLightbox/MigrationSplash (scan `document.body` for portaled content; disable `color-contrast`)
- [ ] `src/tests/a11y/overflow-menu.test.tsx` — ⋯ menu keyboard + delete-wiring
- [ ] `src/tests/a11y/touch-targets.test.tsx` — 44px assertions
- [ ] `tests/e2e/keyboard-flow.spec.ts` — `@axe-core/playwright` record→edit→save
- [ ] Framework install: `npm install -D jest-axe@10 @axe-core/playwright@4`; add `expect.extend(toHaveNoViolations)` (in a shared a11y test helper or `src/tests/setup.ts`)
- [ ] Watch existing SwipeableRow `vi.mock` sites don't break when ⋯ menu is added to row components

## Security Domain

> `security_enforcement` not set in config — treat as enabled. This phase is a11y-only; security surface is minimal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged — no auth touch (CONTEXT) |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | overflow Delete reuses existing `onDelete`, which already enforces existing RLS/auth (D-04); no new privileged path |
| V5 Input Validation | no | ReturnDialog textarea unchanged; no new inputs persisted |
| V6 Cryptography | no | none |

### Known Threat Patterns for React client a11y
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Focus restored to a removed/poisoned element after delete | Tampering/DoS (minor) | Null + `isConnected` check before `.focus()` (Pitfall 4) |
| New delete affordance bypassing existing confirm | Elevation (accidental) | D-04 mandates routing through existing `ConfirmDialog` — no new delete path |

No new attack surface: no network calls, no new data writes, no auth changes. Dev-deps are test-only and never shipped.

## Sources

### Primary (HIGH confidence)
- Codebase (grep + Read, file:line): modal inventory, focus token `src/ui/tokens/base.css:170`, icon set `src/ui/icons.tsx`, test config `vite.config.ts` / `playwright.config.ts`, setup `src/tests/setup.ts`, reduced-motion idiom `src/ui/Waveform.tsx:24`
- npm registry (`npm view`): `jest-axe@10.0.0` (bundles `axe-core@4.10.2`, own types), `@axe-core/playwright@4.11.3`, `@types/jest-axe@3.5.9` (stale — avoid)
- slopcheck v0.6.1: both deps `[OK]`
- npm downloads API: jest-axe ~1.66M/wk, @axe-core/playwright ~4.4M/wk
- 37-CONTEXT.md (D-01..D-07), 37-UI-SPEC.md (interaction contract)

### Secondary (MEDIUM confidence)
- WAI-ARIA APG dialog (modal) + menu-button patterns (training knowledge — focusable selector, aria-labelledby, aria-haspopup) — flagged `[ASSUMED]` in Assumptions Log

### Tertiary (LOW confidence)
- jest-axe-under-Vitest `expect.extend` wiring and `AxeBuilder` import shape — verify on first test (A4/A5)

## Metadata

**Confidence breakdown:**
- Modal inventory + file:line targets: HIGH — fully grep/Read-verified, including the negative finding (no hidden 6th dialog)
- Standard stack (deps): HIGH — registry + slopcheck verified
- Focus-trap contract: MEDIUM-HIGH — behaviors clear; selector/APG details `[ASSUMED]`
- Test wiring (jest-axe/Vitest, AxeBuilder): MEDIUM — verify on first test
- Touch-target + icon audit: HIGH — node-scanned, near-zero pre-existing gaps

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable domain; deps may bump patch — re-check `@axe-core/playwright` which released 4.11.3 the day before research)
