# Phase 37: a11y-foundation - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Additive accessibility primitives across the existing UI — no new user-facing
features, no schema/auth/data changes. Four deliverables, all from the Codex
audit backlog:

1. Modal focus-trap + `aria-modal` primitive applied to **every** modal site.
2. 44px minimum touch targets across action buttons (Codex #46).
3. Tooltips / `aria-label`s for icon-only buttons (Codex #49).
4. A non-swipe delete affordance so non-swipe-aware and keyboard/SR users can
   delete (Codex #32).

Gate: axe-core scan clean on representative pages; keyboard-only navigation
completes the record/edit/save flow.

</domain>

<decisions>
## Implementation Decisions

### Focus-trap mechanism (default — not deep-discussed)
- **D-01:** Hand-roll a `useFocusTrap` hook (zero deps, ~80 LOC). No
  focus-trap-react / Radix / headlessui. Honors the standing TPC "no new npm
  deps for fixes" guardrail and the repo has no a11y lib today. Hook handles:
  initial focus, Tab/Shift+Tab cycling within the modal, Escape-to-close, and
  focus restoration to the trigger on close.

### Modal rollout shape (default — not deep-discussed)
- **D-02:** Build one shared `<Modal>` primitive (overlay + `role="dialog"` +
  `aria-modal="true"` + `useFocusTrap`) and migrate all ~7 dialog sites to it
  rather than dropping the hook into each modal in-place. Sites to migrate:
  `ConfirmDialog`, `ReturnDialog`, `ItemPeekModal`, `PhotoLightbox`,
  `MigrationSplash`, plus any `fixed inset-0` dialog overlays in
  `SessionDetail`/`NewSession`/`ItemList`. `MigrationSplash` already sets
  `aria-modal` but has no real trap — fold it in.
- **Note:** transient toasts/indicators (`ErrorToast`, `RecordingToast`,
  `RecordingIndicator`, `ContinuousModeControlBar`) are NOT modals — do not
  trap focus on them.

### Swipe-delete alternative (DISCUSSED — locked)
- **D-03:** **Overflow (⋯) menu.** Each row in `SessionTile` / `SessionCard` /
  `ItemCard` gets an icon-button `⋯` that opens a small menu containing Delete
  (with room for future row actions). Keyboard- and screen-reader-reachable,
  44px target, scales beyond a single action. The existing swipe gesture
  (`SwipeableRow`) **stays** as a power-user shortcut — the menu is the
  accessible-equivalent path, not a replacement.
- **D-04:** Delete from the overflow menu reuses the existing `ConfirmDialog`
  flow (which itself becomes focus-trapped via D-02) — same confirm semantics
  as swipe-delete today. No new delete logic.

### a11y test tooling (default — not deep-discussed)
- **D-05:** Use **both** — `jest-axe` for fast per-component axe scans inside
  the existing Vitest+jsdom suite, and `@axe-core/playwright` for the
  keyboard-only record→edit→save e2e flow (Playwright already a dep). These are
  the only two new dev-deps permitted by this phase (test-only, not shipped).

### Touch targets + icon labels (Claude's discretion)
- **D-06:** 44px targets via a shared Tailwind utility (`min-h-11 min-w-11`,
  expand hit-area with padding rather than ballooning icon glyphs where a
  larger glyph would look wrong). Apply across action/icon buttons.
- **D-07:** Icon-only buttons get `aria-label` always; add a visible tooltip
  (title/tooltip pattern) where hover affordance aids sighted users. Planner
  picks the exact per-button copy.

### Claude's Discretion
- Exact `useFocusTrap` API shape, `<Modal>` prop surface, overflow-menu
  component (hand-rolled vs reuse of any existing menu pattern), tooltip
  rendering mechanism, and per-button label/tooltip copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` (Phase 37 block) — the four deliverables + Codex issue
  numbers (#33, #34, #48 focus-trap; #46 touch targets; #49 icon labels; #32
  swipe alternative) + the axe/keyboard test gate.

### Existing code to migrate / extend
- `src/components/SwipeableRow.tsx` — current swipe-delete; gains the overflow-menu sibling, not replaced.
- `src/components/SessionTile.tsx`, `src/components/SessionCard.tsx`, `src/components/ItemCard.tsx` — swipe-delete consumers that get the ⋯ menu.
- `src/components/ConfirmDialog.tsx` — reused by D-04 for overflow-menu delete confirm.
- `src/components/{ReturnDialog,ItemPeekModal,PhotoLightbox,MigrationSplash}.tsx` — modal sites to migrate onto `<Modal>` (D-02).

### Cross-app
- No schema/auth touch — this phase does NOT go through `../_workspace/Schema/`. Additive UI only.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SwipeableRow.tsx`: pointer-based swipe with direction-lock + snap; keep as-is, add ⋯ menu alongside.
- `ConfirmDialog.tsx`: existing confirm flow — overflow-menu Delete routes through it (D-04).
- `MigrationSplash.tsx`: already has `aria-modal="true"` — reference point + first migration target for the real trap.

### Established Patterns
- All modals are hand-rolled (`fixed inset-0` / `z-50` overlays, no Radix/headlessui). The `<Modal>` primitive must match this Tailwind overlay idiom, not introduce a library.
- Test stack: Vitest `--run` + jsdom + @testing-library/react + @testing-library/user-event; Playwright present for e2e. axe-core not yet installed.

### Integration Points
- `<Modal>` wraps each existing dialog body; trigger components pass open/onClose.
- Overflow menu mounts inside each row component (Session/Item cards), invoking the same `onDelete` that `SwipeableRow` calls today.

</code_context>

<specifics>
## Specific Ideas

- Swipe gesture is preserved as a shortcut; overflow menu is the accessible
  equivalent path (explicitly NOT removing swipe).
- Toasts/indicators are excluded from focus-trapping — only true dialogs trap.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Additional row actions beyond
Delete in the ⋯ menu are out of scope for v1.3; the menu just leaves structural
room for them.)

</deferred>

---

*Phase: 37-a11y-foundation*
*Context gathered: 2026-06-01*
