# Phase 37: a11y-foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 37-a11y-foundation
**Areas presented:** Focus-trap mechanism, Modal rollout shape, Swipe-delete alternative, a11y test tooling
**Areas deep-discussed:** Swipe-delete alternative (others taken on recommended defaults)

---

## Gray-area selection

| Area | Description | Selected for discussion |
|------|-------------|----------|
| Focus-trap mechanism | Hand-rolled hook vs focus-trap-react vs Radix | (default: hand-rolled hook) |
| Modal rollout shape | Shared `<Modal>` vs in-place hook | (default: shared `<Modal>`) |
| Swipe-delete alternative | Long-press / explicit button / overflow menu | ✓ |
| a11y test tooling | jest-axe vs @axe-core/playwright | (default: both) |

User selected only **Swipe-delete alternative**; accepted recommended defaults on the other three.

---

## Swipe-delete alternative

| Option | Description | Selected |
|--------|-------------|----------|
| Overflow (⋯) menu | Icon-button per row opens menu with Delete; keyboard/SR reachable, 44px, scales; swipe stays as shortcut | ✓ |
| Always-visible delete button | Trash icon always shown; simplest/discoverable but clutter + accidental-delete risk | |
| Long-press | Press-and-hold reveals delete; low clutter but poor discoverability + weak for keyboard/SR | |

**User's choice:** Overflow (⋯) menu
**Notes:** Swipe gesture preserved as power-user shortcut; menu is the accessible-equivalent path. Delete reuses existing ConfirmDialog (no new delete logic).

---

## Defaulted areas (recommendations accepted)

- **Focus-trap:** hand-rolled `useFocusTrap` hook, zero deps — honors TPC no-new-deps guardrail.
- **Modal rollout:** one shared `<Modal>` primitive, migrate all ~7 dialog sites (toasts/indicators excluded).
- **Test tooling:** jest-axe (component, in Vitest) + @axe-core/playwright (keyboard record→edit→save e2e); only new dev-deps, test-only.

## Claude's Discretion

- `useFocusTrap` API shape, `<Modal>` prop surface, overflow-menu component impl, tooltip rendering mechanism, per-button aria-label/tooltip copy, 44px hit-area technique (padding vs glyph size).

## Deferred Ideas

None — discussion stayed within phase scope. Additional row actions in the ⋯ menu beyond Delete are out of scope for v1.3 (menu leaves structural room only).
