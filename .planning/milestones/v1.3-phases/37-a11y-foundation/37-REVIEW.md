---
phase: 37-a11y-foundation
reviewed: 2026-06-02T00:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - src/hooks/useFocusTrap.ts
  - src/ui/Modal.tsx
  - src/ui/OverflowMenu.tsx
  - src/components/ConfirmDialog.tsx
  - src/components/ReturnDialog.tsx
  - src/components/ItemPeekModal.tsx
  - src/components/PhotoLightbox.tsx
  - src/components/MigrationSplash.tsx
  - src/components/ItemCard.tsx
  - src/components/SessionTile.tsx
  - src/components/SessionCard.tsx
  - src/pages/Login.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-06-02
**Depth:** deep (cross-file: focus-trap call graph, Modal migration of 5 dialogs, overflow-menu delete wiring across 3 rows)
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 37 lands a hand-rolled `useFocusTrap`, a shared `<Modal>` primitive, an `OverflowMenu`, and migrates five dialogs plus three row components. The headline focus-management goals are largely met: Escape always closes, the `isConnected` restore guard prevents throwing on a deleted opener, the nested PhotoLightbox→ConfirmDialog handoff is correct (inner panel owns its own keydown listener, so Escape closes only the confirm), the overflow-menu delete routes through the existing `ConfirmDialog`/`onDelete` path with no new unconfirmed destructive path, 44px targets are applied to the ⋯ trigger, icon-only buttons carry `aria-label`s, and only test-only devDependencies were added (guardrail satisfied).

The dominant defect is **`useFocusTrap`'s effect dependency on the unstable `onClose` callback**, which re-runs the entire trap setup on any parent re-render while a modal is open. That both steals focus back to the initial element mid-interaction and corrupts the focus-restore target. Every migrated caller passes a fresh `onClose`/`onCancel` closure, so this fires in production whenever the dialog's parent re-renders (Dexie emits, AI-status polling, migration progress ticks). This is the one BLOCKER. The remaining findings are robustness/correctness gaps that should be fixed but do not lock the user out.

## Critical Issues

### CR-01: `useFocusTrap` re-runs on every parent re-render, stealing focus and corrupting the restore target

**File:** `src/hooks/useFocusTrap.ts:54-107` (effect), `:107` (dependency array)
**Issue:**
The effect's dependency array is `[panelRef, onClose, initialFocusRef]`. `panelRef` is stable, but `onClose` is supplied as a **new function on every render** by every caller in this phase:
- `ConfirmDialog.tsx:31` → `onClose={onCancel}`, where callers pass inline arrows, e.g. `ItemCard.tsx:425` `onCancel={() => setShowDeleteConfirm(false)}` and `PhotoLightbox.tsx:179` `onCancel={() => setShowDeleteConfirm(false)}`.
- `ReturnDialog.tsx:37` → `onClose={handleCancel}` (re-created each render).
- `MigrationSplash.tsx:48` → `onClose: () => {}` (a fresh empty arrow every render).

Because `onClose` changes identity each render, React tears down and re-creates the effect on **every re-render of the modal's parent while the modal is open**. This is not hypothetical: `ItemCard` re-renders on Dexie `useLiveQuery` emits and `useAudioUploadStatus` polling; `MigrationSplash` re-renders on every `current`/progress tick. Each effect re-run does two harmful things:

1. **Re-saves the restore target from inside the panel.** Line 59 runs again: `const previouslyFocused = document.activeElement`. By now the active element is a control *inside* the panel (the user moved there), so the original opener is lost. On final unmount, focus restores to a panel child (now detached) instead of the trigger — the `isConnected` guard then silently drops the restore entirely, dumping focus to `<body>`. This regresses the very Codex #33/#34/#48 focus-restore requirement the phase exists to satisfy.
2. **Forcibly re-focuses the initial element.** Lines 62-68 run again, yanking focus back to the first focusable (or `initialFocusRef`). In `ReturnDialog` a progress/parent re-render snaps the caret out of the textarea back to its start; in `ConfirmDialog` it bounces focus off the Confirm button back to Cancel mid-keyboard-navigation.

The existing tests miss this because they render a static harness with a stable `onClose` (`use-focus-trap.test.tsx:78` passes `vi.fn()` once) and never re-render the parent while the trap is mounted.

**Fix:** Run the setup-and-restore logic once per mount, and keep the live `onClose` in a ref so the keydown handler always calls the latest one without re-arming the effect:

```ts
export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  { onClose, initialFocusRef }: UseFocusTrapOptions,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusEl = initialFocusRef; // ref object is already stable

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const initial = initialFocusEl?.current ?? getFocusable(panel)[0];
    if (initial) initial.focus();
    else { panel.setAttribute("tabindex", "-1"); panel.focus(); }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();   // always latest, no re-arm
        return;
      }
      // ...Tab logic unchanged...
    }
    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [panelRef, initialFocusEl]); // onClose removed from deps
}
```

Add a regression test that re-renders the trap's parent (new `onClose` identity) while open and asserts focus does NOT jump back to the first focusable and the restore target is still the opener.

## Warnings

### WR-01: `OverflowMenu.onMenuKeyDown` divides by `items.length` without guarding empty list

**File:** `src/ui/OverflowMenu.tsx:96-114`
**Issue:** `items[(activeIndex + 1) % items.length]` and the ArrowUp variant compute `% items.length`. If `actions` is ever empty (or all items are transiently unrendered), `items.length === 0` makes the modulo `NaN` and the index access a no-op at best; combined with `activeIndex` of `-1` (when focus is not on a menuitem) the arithmetic is fragile. The menu is only opened with at least one action today, but the component is a reusable primitive with a `OverflowAction[]` prop and no minimum-length contract.
**Fix:** Early-return when `items.length === 0`, e.g. `if (items.length === 0) return;` before the Arrow branches; this also documents the invariant.

### WR-02: `Modal` calls `useFocusTrap` before the `if (!open) return null`, so a kept-mounted Modal toggled `open=false→true` never re-arms the trap

**File:** `src/ui/Modal.tsx:71-73`
**Issue:** `useFocusTrap(panelRef, …)` runs unconditionally, then `if (!open) return null`. When `open` flips false→true while the same `<Modal>` instance stays mounted, the panel mounts but the effect deps `[panelRef, onClose, initialFocusRef]` may be unchanged (`panelRef` is always stable), so the trap setup (initial focus, keydown listener) does not re-run — a modal with no focus trap and no Escape handling. All five migrated callers currently gate on `open`/`item` *before* rendering `<Modal>` (so Modal remounts and this is masked), but Modal's own `open` prop + internal null-return advertises the keep-mounted pattern as supported. It is a latent landmine for the next caller. Note this interacts with CR-01's fix: once `onClose` leaves the deps, keep-mounted toggling has even fewer deps to trigger a re-arm.
**Fix:** Add `open` to the trap's re-arm signal — either include `open` in the `useFocusTrap` effect deps (pass it in), or early-return `null` from Modal *before* calling the hook is not possible (hook order), so instead key the trap on open: have Modal mount the panel subtree in a child component that is only rendered when `open` is true, so the hook mounts/unmounts with `open`.

### WR-03: `ItemPeekModal` reads `item.sort_order + 1` without null/undefined guard

**File:** `src/components/ItemPeekModal.tsx:40`
**Issue:** `Item #{item.sort_order + 1}` assumes `sort_order` is a number. If `sort_order` is ever `null`/`undefined` for a row (it is a DB column; the generated type may allow null), `null + 1 === 1` masks the bug silently, and `undefined + 1 === NaN` renders `Item #NaN`. Given the modal already defensively coalesces the title (`item.receipt_number ?? item.title ?? "Unlabeled item"`), the ordinal deserves the same care.
**Fix:** `Item #{typeof item.sort_order === "number" ? item.sort_order + 1 : "?"}` or coerce upstream.

### WR-04: `PhotoLightbox.handleDelete` uses non-null assertion `currentPhoto.id!`

**File:** `src/components/PhotoLightbox.tsx:96`
**Issue:** `const photoId = currentPhoto.id!;` force-asserts a defined id, then passes it to `onDelete(photoId)`. `ItemPhoto.id` is an auto-increment Dexie key that is `undefined` for a not-yet-persisted record. If a freshly captured, unsaved photo reaches the lightbox, `onDelete(undefined)` is dispatched to the parent delete handler — a silent wrong-target or no-op delete. The lightbox already guards `photos.length === 0`; an undefined-id guard is the same class of safety.
**Fix:** `if (currentPhoto.id == null) return;` before deleting, or disable the trash button when `currentPhoto.id == null`.

### WR-05: `MigrationSplash` Escape is a silent no-op with no documented escape hatch for the error state

**File:** `src/components/MigrationSplash.tsx:48`
**Issue:** `useFocusTrap(panelRef, { onClose: () => {} })` deliberately swallows Escape. For `in-progress`/`complete`/`partial` this is acceptable (the modal auto-dismisses or is genuinely blocking). But in the **`error`** state the modal does NOT auto-dismiss (the `useEffect` at :53 returns early for non-complete/non-partial), and Escape does nothing, so a keyboard user who lands here can only proceed via the Retry/Skip buttons. That is technically a working path, but combined with CR-01 (focus thrash on re-render) and the fact that the swallowed Escape is invisible to AT users, it is a usability trap worth hardening: Escape on the error state should at least map to `onSkip` (the "continue anyway" affordance).
**Fix:** Pass a state-aware close: `onClose: state === "error" ? onSkip : () => {}`.

### WR-06: `SessionTile`/`SessionCard` overflow-menu Delete and the row swipe Delete both fire the parent `onDelete` with no confirm inside the component — confirm correctness depends entirely on the (untyped) parent contract

**File:** `src/components/SessionTile.tsx:202-204`, `src/components/SessionCard.tsx:169-171`
**Issue:** Unlike `ItemCard` (which routes ⋯→Delete through its own local `ConfirmDialog`), `SessionTile`/`SessionCard` wire ⋯→Delete straight to the `onDelete` prop, relying on the parent (`Sessions.tsx`) to show the confirm. D-04 requires the overflow delete to reuse the existing confirm flow. This is satisfied *only if* every `onDelete` passed in is the confirm-gated one. There is no type-level or runtime guarantee — a future caller passing a raw `deleteSession` would get an immediate unconfirmed destructive delete from the accessible affordance, which is exactly the threat T-37-05 is meant to close. The phase relies on convention, not enforcement.
**Fix:** Document the `onDelete` contract in the prop JSDoc ("must itself confirm — the ⋯ menu does not"), and/or add a row-level confirm consistent with `ItemCard` so all three rows behave identically. At minimum, add a test asserting the parent wires the confirm-gated handler.

## Info

### IN-01: `usePrefersReducedMotion` is duplicated verbatim across three files

**File:** `src/ui/Modal.tsx:42-55`, `src/ui/OverflowMenu.tsx:37-50`, `src/components/MigrationSplash.tsx:5-18`
**Issue:** The identical `usePrefersReducedMotion` hook is copy-pasted three times. Drift risk if one is fixed (e.g., SSR guard) and others are not.
**Fix:** Extract to `src/hooks/usePrefersReducedMotion.ts` and import in all three.

### IN-02: `useFocusTrap` Tab handler compares `document.activeElement` across portal/shadow boundaries by identity only

**File:** `src/hooks/useFocusTrap.ts:85-95`
**Issue:** `active === last` / `active === first` identity checks work for the current portaled-to-body modals, but `panel!.contains(active)` (line 88) is only used in the Shift+Tab branch, not the forward-Tab branch. If focus is somehow outside the panel on a forward Tab (e.g., programmatic focus moved it), the forward branch won't re-trap it. Minor given the nested-trap design, but asymmetric with the Shift+Tab branch.
**Fix:** Mirror the `!panel.contains(active)` guard in the forward-Tab branch for symmetry.

### IN-03: `MigrationSplash` `onComplete` is in the auto-dismiss effect deps while being a likely-unstable callback

**File:** `src/components/MigrationSplash.tsx:50-68`
**Issue:** The dismiss-timer effect deps are `[state, onComplete]`. If `onComplete` is an unstable closure from the parent, changing it re-arms the 1500/1800ms timers, potentially delaying or restarting the auto-dismiss. Lower-severity sibling of CR-01.
**Fix:** Stabilize `onComplete` at the call site (`useCallback`) or hold it in a ref inside the effect.

### IN-04: `ConfirmDialog` destructive button color is hardcoded `bg-red-500` instead of the design token

**File:** `src/components/ConfirmDialog.tsx:51`
**Issue:** The destructive button uses Tailwind `bg-red-500`, while `OverflowMenu` and the rest of the a11y work use the `--err` token (`color: "var(--err)"`). Inconsistent destructive ink across the same phase.
**Fix:** Use the project `--err` token / `tpc-btn-danger` class for parity.

---

_Reviewed: 2026-06-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
