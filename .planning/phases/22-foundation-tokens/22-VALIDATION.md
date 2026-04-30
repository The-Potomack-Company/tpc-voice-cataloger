---
phase: 22
slug: foundation-tokens
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/22-foundation-tokens/22-RESEARCH.md` §"Validation Architecture"

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (jsdom env, `globals: true`) |
| **Config file** | `vite.config.ts` (`test: { globals: true, environment: "jsdom", setupFiles: ["src/tests/setup.ts"] }`) |
| **Quick run command** | `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` |
| **Full suite command** | `npm test` (Vitest `--run`) |
| **Estimated runtime** | ~5–10 seconds for the literals scan; full suite ~30s |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npm test -- src/ui/__tests__/` (subset, fast)
- **After every plan wave:** Run `npm run lint && npm test && npm run build` (full)
- **Before `/gsd-verify-work`:** Full suite must be green AND manual visual smoke on Sessions / Recording / Review / Settings / AccountManagement in **both** light and dark mode (5 routes × 2 modes = 10 visual checks). Cross-tab parity: open page, toggle OS theme, confirm live flip without reload.
- **Max feedback latency:** 30 seconds (full Vitest suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-* | 01 (Tokens scaffold) | 1 | TOKENS-01 | — | N/A | unit (build smoke) | `npm run build` | ✅ existing | ⬜ pending |
| 22-02-* | 02 (Bridge + dark variant) | 2 | TOKENS-01, TOKENS-02 | — | N/A | manual (visual smoke) + build | `npm run build` + manual `npm run dev` route walk | ✅ existing | ⬜ pending |
| 22-03-* | 03 (Pre-paint bootstrap) | 2 | TOKENS-02 | — | N/A | unit (initTheme jsdom) + manual (FOUC) | `npm test -- src/ui/__tests__/init-theme.test.ts` | ❌ W0 | ⬜ pending |
| 22-04-* | 04 (TOKENS-04 guard) | 3 | TOKENS-04 | — | N/A | unit (filesystem regex) | `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` | ❌ W0 | ⬜ pending |
| 22-05-* | 05 (pwa-manifest test fix-up) | 1 | TOKENS-04 (precondition) | — | N/A | unit | `npm test -- src/tests/pwa-manifest.test.ts` | ✅ existing (modify) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Note: Final task IDs/wave assignment determined by the planner — this row map reflects expected plan boundaries.*

---

## Wave 0 Requirements

- [ ] `src/ui/__tests__/no-hardcoded-literals.test.ts` — covers TOKENS-04 (full implementation in Phase 22). Vitest filesystem regex sweep over `.ts`/`.tsx`/`.css` under `src/`, asserts no hex (`/#[0-9a-fA-F]{3,8}\b/`), `oklch(...)`, or font-family literal. Allowlist: `src/ui/tokens/**`. On failure prints aggregated `{file, line, snippet, pattern_matched}` list.
- [ ] `src/ui/__tests__/init-theme.test.ts` — covers `initTheme()` matchMedia listener attach/teardown via jsdom. Existing `src/tests/setup.ts` matchMedia mock supports this. ~30 LOC. Guards Phase 25's contract (teardown signature must remain stable).
- [ ] **Modification (not net-new):** `src/tests/pwa-manifest.test.ts` lines 25–26 — replace `expect(viteConfig).toContain('theme_color: "#2563eb"')` with `expect(viteConfig).toMatch(/theme_color:\s*"#[0-9a-f]+"/i)`. Without this fix-up, TOKENS-04 fails on its first run because the existing test contains literal `#2563eb` strings.
- [ ] **No new framework install needed.** Vitest, @testing-library, jsdom all in place.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No FOUC on cold load with system dark mode | TOKENS-02 | No reliable automated check; Playwright OS-pref control is brittle | `npm run build && npm run preview`; on a system in dark mode, hard reload, confirm no light flash before paint |
| Live OS dark/light flip propagates to page within one frame | TOKENS-02 | Requires real OS-level pref toggle | Open `npm run dev`; toggle OS dark mode; confirm `<html>` class flips and surfaces re-theme without reload |
| `@theme inline` bridge produces working utilities (`bg-bg-2`, `text-ink-3`, `bg-warn-wash`, `rounded-md`, `font-display`) | TOKENS-01 | Brittle to assert "Tailwind utility X resolves to oklch from token" in unit test | DevTools inspect on any element using a bridged utility; confirm computed style resolves to `oklch(...)` from the active `.tpc` / `.tpc-dark` cascade |
| Existing 282 `dark:` utilities still render correctly | TOKENS-02 (cross-cutting) | "No broken styling" gate per ROADMAP success criterion #4 | Walk Sessions, Recording, Review, Settings, AccountManagement screens in both light and dark mode; confirm no white-on-white or black-on-black surfaces |
| Paired `<meta name="theme-color">` colors look correct in browser chrome | TOKENS-01 (Claude's Discretion) | Subjective hex match to the OKLCH `--accent` token | Open page in Safari iOS / Chrome Android (or DevTools mobile emu) in light + dark; confirm browser chrome matches page accent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (TOKENS-04 unit test, initTheme unit test, pwa-manifest fix-up)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (build + lint run on every commit; literals scan on every commit after Wave 0 lands)
- [ ] Wave 0 covers all MISSING references (`no-hardcoded-literals.test.ts`, `init-theme.test.ts`, `pwa-manifest.test.ts` modification)
- [ ] No watch-mode flags (Vitest runs in `--run` mode in CI)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
