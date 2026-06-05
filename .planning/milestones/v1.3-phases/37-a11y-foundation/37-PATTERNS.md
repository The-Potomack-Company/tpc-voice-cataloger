# Phase 37: a11y-foundation - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 14 (5 new, 9 modified) + test wiring
**Analogs found:** 12 / 14 (2 net-new primitives have idiom-analogs only)

> This phase is additive a11y plumbing over a hand-rolled, token-driven UI. Almost
> everything except `useFocusTrap`, `<Modal>`, and the overflow ⋯ menu already exists
> in the repo — the planner is mostly wiring existing primitives. All file:line targets
> below are grep/Read-verified against the working tree.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useFocusTrap.ts` | hook | event-driven | `src/ui/Waveform.tsx` (matchMedia/effect idiom) | idiom-only (net-new) |
| `src/ui/Modal.tsx` | component (primitive) | request-response | `src/components/ConfirmDialog.tsx` (portal+scrim) | role-match |
| `src/ui/OverflowMenu.tsx` | component | event-driven | `src/components/ItemPeekModal.tsx` (icon-btn + portal idiom) | idiom-only (net-new) |
| `src/ui/touch-target` utility (Tailwind class pair) | utility | n/a | `ConfirmDialog.tsx:37,44` (`min-h-12`) | role-match |
| `src/tests/setup.ts` (jest-axe wiring) | test-config | n/a | existing `src/tests/setup.ts` | exact (extend) |
| `src/components/ConfirmDialog.tsx` | component | request-response | self (migrate to `<Modal>`) | exact |
| `src/components/ReturnDialog.tsx` | component | request-response | `ConfirmDialog.tsx` | exact |
| `src/components/ItemPeekModal.tsx` | component | request-response | `ConfirmDialog.tsx` | role-match |
| `src/components/PhotoLightbox.tsx` | component | request-response | `ConfirmDialog.tsx` (+ nested-modal care) | role-match |
| `src/components/MigrationSplash.tsx` | component | event-driven | self (`aria-modal` already present) | exact |
| `src/components/SessionTile.tsx` | component (row) | event-driven | `ItemCard.tsx` (overflow-delete wiring) | role-match |
| `src/components/SessionCard.tsx` | component (row) | event-driven | `ItemCard.tsx` / `SessionTile.tsx` | role-match |
| `src/components/ItemCard.tsx` | component (row) | event-driven | self (`setShowDeleteConfirm` + local ConfirmDialog) | exact |
| `src/tests/a11y/*.test.tsx` | test | n/a | `src/tests/return-dialog.test.tsx` (RTL+portal) | role-match |
| `tests/e2e/keyboard-flow.spec.ts` | test (e2e) | n/a | `tests/e2e/visual-smoke.spec.ts` (auth gate) | role-match |

## Pattern Assignments

### `src/hooks/useFocusTrap.ts` (NEW hook — D-01)

**Analog:** No existing focus hook. Reuse the repo's `prefers-reduced-motion` effect
idiom from `src/ui/Waveform.tsx:21-30` (only relevant if `<Modal>` animates).

**Reduced-motion idiom** (`src/ui/Waveform.tsx:21-25`) — copy verbatim, do NOT re-derive:
```ts
function usePrefersReducedMotion(): boolean {
  const [pref, setPref] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  // ... addEventListener('change', ...) in an effect (Waveform.tsx:26-30)
}
```
Same idiom also at `src/hooks/useAudioRecorder.ts:97`.

**Contract to implement (RESEARCH Pattern 1, no analog — hand-roll):**
- Focusable selector: `a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])`
- Recompute focusables on **each** Tab keydown (not cached on mount) — ReturnDialog textarea + MigrationSplash conditional buttons appear/disappear.
- Save `document.activeElement` on mount; on unmount, null-check + `isConnected` guard before `.focus()` (delete flow can unmount the trigger — RESEARCH Pitfall 4).
- Escape → `onClose()`.

**No existing test analog for hooks** — model the test on `src/tests/return-dialog.test.tsx`
using `@testing-library/user-event` (`user.tab()`, `user.keyboard('{Escape}')`).

---

### `src/ui/Modal.tsx` (NEW shared primitive — D-02)

**Analog:** `src/components/ConfirmDialog.tsx` (full file, 55 LOC) — the canonical
portal+scrim idiom to generalize.

**Portal + scrim pattern** (`ConfirmDialog.tsx:1, 26-27, 52-54`) — copy the shape:
```tsx
import { createPortal } from "react-dom";
// ...
return createPortal(
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 dark:bg-gray-800">
      {/* panel body */}
    </div>
  </div>,
  document.body,
);
```

**ARIA additions the primitive must add** (NOT present in ConfirmDialog today; copy
from `MigrationSplash.tsx:81-83` which already has them):
```tsx
role="dialog"
aria-modal="true"
aria-labelledby={/* id of the panel <h2>/<h3> */}   // prefer over aria-label where a heading exists
```

**Scrim token note (UI-SPEC line 106):** standardize on a `--bg-3` reduced-opacity
scrim (existing scrims vary: `bg-black/50` ConfirmDialog/ReturnDialog, `bg-ink/40`
ItemPeekModal:26, opaque `bg-white dark:bg-gray-900` MigrationSplash:78). **Preserve
MigrationSplash's opaque full-screen splash look** — it's a splash, not a centered dialog.

**Prop surface (Claude's discretion, RESEARCH-suggested):**
`{ open, onClose, ariaLabelledBy?/ariaLabel, children, initialFocusRef? }`. Keep
portaling to `document.body`. Wire `useFocusTrap(panelRef, { onClose })` inside.

---

### `src/ui/OverflowMenu.tsx` (NEW ⋯ menu — D-03)

**Analog:** `src/components/ItemPeekModal.tsx:35-43` for the icon-button + `<Icon>` idiom;
`ItemCard.tsx:402-410` for the delete-confirm wiring it triggers.

**Icon-button trigger idiom** (`ItemPeekModal.tsx:35-43`):
```tsx
<button
  type="button"
  onClick={onClose}
  className="tpc-btn tpc-btn-ghost"
  style={{ padding: 6 }}            // ← this is ~28px; the ⋯ trigger must instead be 44px (min-h-11 min-w-11)
  aria-label="Close item preview"
>
  <Icon name="x" size={16} aria-hidden />
</button>
```

**Icon API** (`src/ui/icons.tsx:369-395`): `<Icon name size aria-label />`. When
`aria-label` is omitted the SVG auto-sets `aria-hidden` (`icons.tsx:394`). The `dots`
glyph exists at `icons.tsx:101`, `trash` at `icons.tsx:163` — use both, do NOT add SVGs.

**Trigger contract (RESEARCH Pattern 3, APG menu-button `[ASSUMED]`):**
- `aria-haspopup="menu"` + `aria-expanded`, `aria-label="More actions"` (UI-SPEC line 90), visible tooltip == aria-label.
- Trigger box = 44px (`min-h-11 min-w-11`), grow via padding not glyph (D-06).
- Menu items keyboard-reachable; Escape closes menu + restores focus to ⋯ trigger.
- **Focus ring:** there is NO generic `*:focus-visible` rule — menu items must carry
  `tpc-btn` / `tpc-card-interactive` class (or replicate the box-shadow) to get a ring (see Shared Patterns → Focus Ring).
- Delete item label uses `--err` ink (UI-SPEC line 123); honor `prefers-reduced-motion` on open/close.

---

### `src/components/ConfirmDialog.tsx` (MIGRATE → `<Modal>`)

**Analog:** self. Highest leverage — **8 render sites inherit the trap** once migrated
(AccountManagement:286, ItemCard:402, ItemList:407, NewSession:333, Settings:289,
Sessions:596, PhotoLightbox:159 nested, SessionDetail:683/694/705/716).

**Current state** (`ConfirmDialog.tsx:24-54`): `createPortal`, `bg-black/50` scrim,
NO `role`/`aria-modal`/trap/Escape. Migration = wrap the inner panel body in `<Modal>`,
drop the hand-rolled outer `fixed inset-0` div (Modal supplies it). Keep `destructive`
red-button branch (`:44-46`). Escape === cancel (non-destructive default).

**Touch targets already OK:** confirm/cancel buttons use `min-h-12` (48px) at `:37,:44` — leave or normalize to `min-h-11`.

---

### `src/components/ReturnDialog.tsx` (MIGRATE → `<Modal>`)

**Analog:** `ConfirmDialog.tsx` (same portal/scrim shape). `ReturnDialog.tsx:31-66`.
Has a `<textarea>` at `:40-46` — the natural **initial-focus candidate**. Buttons
`min-h-12` at `:51,:58` (already ≥44px). Wrap body in `<Modal>`, add Escape === cancel.

---

### `src/components/ItemPeekModal.tsx` (MIGRATE → `<Modal>` — biggest single gap)

**Analog:** `ConfirmDialog.tsx`. **Currently has NO `role`/`aria-modal`/Escape**
(`ItemPeekModal.tsx:26`, close button only at `:35-43`). Gains all three via `<Modal>`.
Has `<h2>` at `:31` → use `aria-labelledby`. Close button `style={{padding:6}}` (~28px)
should grow to 44px during migration (D-06).

---

### `src/components/PhotoLightbox.tsx` (MIGRATE → `<Modal>` + nested-modal care)

**Analog:** `ConfirmDialog.tsx`. `PhotoLightbox.tsx:113` (`fixed inset-0 z-50`, NO ARIA).
**Has a NESTED `ConfirmDialog` at `:159`** (photo delete) and touch swipe nav
(`onTouchStart/End`). Preserve swipe nav; close/trash already labeled
(`:120 aria-label="Close"`, `:132 aria-label="Delete photo"`, `min-w-12 min-h-12` at `:124,:136`).

**Nested-trap pitfall (RESEARCH Pitfall 1):** when the inner ConfirmDialog opens, the
inner trap (last-mounted) must own focus + Escape; outer lightbox trap yields. Test
explicitly that opening the confirm moves focus inward and Escape returns to the lightbox, not all the way out.

---

### `src/components/MigrationSplash.tsx` (MIGRATE → fold real trap in)

**Analog:** self — **already has `role="dialog"` + `aria-modal="true"`**
(`MigrationSplash.tsx:81-83`) but NO real trap. Fold `useFocusTrap` in; keep the opaque
full-screen splash look (`:78` `bg-white dark:bg-gray-900`), do NOT swap to the centered
scrim. **Gate the opacity transition behind reduced-motion** — it currently animates
unconditionally (`:78` `transition-opacity duration-300`, `fading` state at `:26,:79`);
wrap in the `usePrefersReducedMotion` check (MOTION-04). Conditional error-state buttons
at `:111-124` confirm the per-keydown focusable recompute requirement.

---

### `src/components/ItemCard.tsx` (ADD ⋯ menu — D-03/D-04)

**Analog:** self — already owns the full delete path. Wire the new ⋯ menu's Delete to
the **existing setter**, add NO new logic.

**Existing delete wiring** (`ItemCard.tsx:277-285`, `:402-410`):
```tsx
// trigger (already exists at :280 and :392):
onClick={() => setShowDeleteConfirm(true)}
// local ConfirmDialog (already exists at :402, inside the SwipeableRow at :411):
<ConfirmDialog
  open={showDeleteConfirm}
  title="Delete Item"
  confirmLabel="Delete"
  destructive
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteConfirm(false)}
/>
```
**Menu Delete → `setShowDeleteConfirm(true)`.** ItemCard is wrapped in `SwipeableRow`
(`:411`) — keep the swipe gesture, add ⋯ alongside.

---

### `src/components/SessionTile.tsx` (ADD ⋯ menu — D-03/D-04)

**Analog:** `ItemCard.tsx` for the menu mount; differs in that the confirm dialog is
owned by the **parent**, not local. `SessionTile` takes `onDelete: () => void`
(`SessionTile.tsx:29`) currently passed only to `SwipeableRow`. **Menu Delete → call
the same `onDelete`.** Parent `Sessions.tsx:596` owns the ConfirmDialog. Mount the ⋯
button in the header region (~`SessionTile.tsx:107-201`).

**Test-mock caution:** `SwipeableRow` is `vi.mock`-ed in `src/tests/session-tile.test.tsx`,
`session-assignment.test.tsx`, `sessions-admin-view.test.tsx` — adding the ⋯ menu must not break these mocks.

---

### `src/components/SessionCard.tsx` (ADD ⋯ menu — D-03/D-04)

**Analog:** `SessionTile.tsx` (admin/sale variant of the same tile). Takes
`onDelete: () => void` (`SessionCard.tsx:14`), passed to `SwipeableRow` today. Same
wiring as SessionTile: menu Delete → `onDelete`; parent owns ConfirmDialog. Mount
~`SessionCard.tsx:107-168`.

---

### `src/tests/a11y/*.test.tsx` (NEW jest-axe scans — D-05)

**Analog:** `src/tests/return-dialog.test.tsx` (RTL render of a portaled dialog).

**jest-axe wiring (RESEARCH Code Examples, verify A4 on first test):**
```ts
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);
// <Modal> portals to document.body → scan baseElement/document.body, NOT container:
const results = await axe(document.body, {
  rules: { "color-contrast": { enabled: false } },  // jsdom can't paint (Pitfall 3)
});
expect(results).toHaveNoViolations();
```
Files to create (RESEARCH Wave 0): `use-focus-trap.test.tsx`, `modals.test.tsx`,
`overflow-menu.test.tsx`, `touch-targets.test.tsx`.

**Reduced-motion in jsdom (Pitfall 5):** the setup mock returns `matches:false`
always (`src/tests/setup.ts:8`); override `window.matchMedia` per-test to exercise the reduce branch.

---

### `tests/e2e/keyboard-flow.spec.ts` (NEW e2e — D-05)

**Analog:** `tests/e2e/visual-smoke.spec.ts` (existing auth/login approach + `SUPABASE_URL` gate).

```ts
import AxeBuilder from "@axe-core/playwright";   // verify import shape, A5
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```
Drive record→edit→save with `page.keyboard.press('Tab')`. Auth: match the
storage-state/login approach in `visual-smoke.spec.ts` (RESEARCH Open Question 1).

## Shared Patterns

### Focus Ring (A11Y-02) — reuse verbatim, author NO new ring
**Source:** `src/ui/tokens/base.css:170-176`
**Apply to:** all new focusable elements (Modal panel, overflow-menu items, ⋯ trigger)
```css
.tpc .tpc-btn:focus-visible,
.tpc .tpc-card-interactive:focus-visible,
.tpc .tpc-badge[role="button"]:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-wash);
}
```
**Critical:** there is NO generic `*:focus-visible` rule — focus rings are class-scoped.
New focusables MUST carry `tpc-btn` / `tpc-card-interactive` / `tpc-input` / `tpc-tab`
(or replicate the box-shadow) or they get no visible ring. Inputs use the sibling rule at `base.css:108`.

### Portal idiom
**Source:** `ConfirmDialog.tsx:1,52-54` / `ReturnDialog.tsx:64-65` / `MigrationSplash.tsx:128-129`
**Apply to:** `<Modal>` (keep portaling to `document.body`)
```tsx
import { createPortal } from "react-dom";
return createPortal(<overlay/>, document.body);
```

### 44px touch target (D-06)
**Source:** new utility; existing `min-h-12` (48px) at `ConfirmDialog.tsx:37,44`, `ReturnDialog.tsx:51,58`, `PhotoLightbox.tsx:124,136`
**Apply to:** ⋯ trigger, overflow-menu items, any sub-44px icon button surfaced in migration
- `min-h-11 min-w-11` = 2.75rem = 44px (Tailwind `11`; verify no scale override, A6).
- Grow hit-area with padding, NOT glyph size.

### Icon-button aria-label (D-07)
**Source:** `ErrorToast.tsx:50` (`aria-label="Dismiss"` — canonical verb-noun), also `SessionSearch.tsx:55`, `ItemPeekModal.tsx:41`, `PhotoLightbox.tsx:120,132`
**Apply to:** every icon-only button. Audit found **near-zero pre-existing gaps** — only
NEW elements need labels (⋯ trigger = `aria-label="More actions"`). Tooltip string MUST equal aria-label (UI-SPEC line 93).

### Reduced-motion (MOTION-04)
**Source:** `src/ui/Waveform.tsx:21-30` (also `useAudioRecorder.ts:97`)
**Apply to:** any Modal/menu open-close transition, MigrationSplash opacity fade
```ts
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

### Delete reuse (D-04) — no new delete logic
**Source:** `ItemCard.tsx:280,402` (local `setShowDeleteConfirm` + ConfirmDialog) / `SessionTile.tsx:29` + `Sessions.tsx:596` (parent `onDelete` + ConfirmDialog)
**Apply to:** all three row overflow menus — route Delete through the existing path, never a new one.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/hooks/useFocusTrap.ts` | hook | event-driven | No focus/keyboard-trap hook exists; hand-rolled per D-01. Only the reduced-motion effect idiom (`Waveform.tsx`) is reusable. Core trap logic is net-new (RESEARCH Pattern 1). |
| `src/ui/OverflowMenu.tsx` | component | event-driven | No menu/popover component exists (no Radix/headlessui). Icon-button + portal idioms reusable, but the APG menu-button behavior (haspopup/expanded/roving focus) is net-new. |

## Metadata

**Analog search scope:** `src/components/`, `src/ui/`, `src/hooks/`, `src/tests/`, `tests/e2e/`
**Files scanned (read or grep-verified):** ConfirmDialog, ReturnDialog, ItemPeekModal, MigrationSplash, ItemCard, SessionTile, icons.tsx, tokens/base.css, Waveform.tsx, tests/setup.ts, test + e2e directories
**Pattern extraction date:** 2026-06-02
