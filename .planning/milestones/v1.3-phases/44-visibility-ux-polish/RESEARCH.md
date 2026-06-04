# Phase 44: visibility-ux-polish - Research

**Researched:** 2026-06-04
**Domain:** React 19 UI polish — react-router navigation + Postgres error inspection
**Confidence:** HIGH (all answers read directly from repo source; no external lookups needed)

## Summary

Two isolated, well-bounded UX fixes. Both are surgical edits to a single component
each, fully covered by existing test files that already mock everything needed.
No new dependencies, no schema changes, no scope expansion. Stack already has
`useNavigate` (react-router v7, imported as `react-router`) and a 23505 error shape
that propagates intact to the catch block.

**Primary recommendation:** Two single-file edits + two test extensions. F1 adds a
`title` column to the badge's select and renders a clickable `Link`/`navigate` row;
F4 binds the `handleImport` catch, detects `error.code === '23505'`, and names the
offending receipt tracked in a `let`. Both are comfortably one-plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Blocked-item display + nav (F1) | Browser/Client | — | Pure client render + react-router client nav; data already fetched |
| Duplicate-receipt error naming (F4) | Browser/Client | API/Backend | 23505 raised by Postgres (Supabase) on insert; client only inspects + formats the error |

## Standard Stack

No new packages. Existing in-repo APIs only:
- `react-router` v7 — `useNavigate()` (already imported in `NewSession.tsx:2`) and `Link`.
- `supabase-js` PostgrestError — carries `.code` (`'23505'`) on unique-violation.
- `useNotificationStore` (Zustand) — `notifyError(message, retry?)`.
- Vitest 4.0.18 (`npm test` → `vitest --run`). TDD mode ON, nyquist_validation true.

---

## Fix 1 (F1/U1) — BlockedQueueBadge raw UUIDs → named, tappable rows

### Approach
1. Add `title` to the select in `fetchBlockedItems()` and to the `BlockedItem` interface.
2. Render each `<li>` as a tappable row showing display name + mode, navigating to
   `/session/${item.session_id}/item/${item.id}` on tap. Close the dropdown (`setOpen(false)`) on nav.

### Resolved answers

**Q1 — human-readable name field + fallback**
- Items table has no dedicated "name". The display field is **`title`** (`string | null`,
  `database.types.ts:361`). ItemCard renders the title with a fallback:
  `item.title || "— needs title —"` (`ItemCard.tsx:127`).
- ItemCard ALSO shows a leading identifier line: for sale mode with a receipt,
  `#${item.receipt_number}`; otherwise zero-padded `sort_order` (`ItemCard.tsx:113-115`).
- **Recommended badge display:** `title` when present, else the receipt (`#<receipt_number>`)
  when present, else fall back to a short id slice. Blank/pending items legitimately have
  `title === null` (createItem inserts `title: null`, `sessionStore.ts:321`), so the fallback
  must be graceful — never show a bare UUID.
- **Select must add:** `title`. Optionally also `receipt_number` for a richer fallback (cheap,
  same query). Minimum is `title`. Final select: `"id, mode, session_id, title"` (+ `receipt_number`
  if using the receipt fallback). Exact column names: `title`, `receipt_number` (both `| null`).

**Q2 — navigation mechanism**
- The badge currently imports no router hook. Sibling header components: `AppLayout.tsx`
  imports `Outlet, NavLink, useLocation` from `"react-router"` (`AppLayout.tsx:2`) — confirms
  the **v7 bare `"react-router"` import path** (not `react-router-dom`). `NewSession.tsx:2`
  uses `useNavigate` from the same path.
- Idiomatic pattern in this repo for tap-to-go-and-do-side-effect (close dropdown) is
  **`useNavigate()`** called inside an `onClick`, because the row must also `setOpen(false)`.
  A bare `<Link>` would navigate but not close the panel. Recommend `useNavigate()` +
  `onClick={() => { setOpen(false); navigate(`/session/${item.session_id}/item/${item.id}`); }}`.
- Route confirmed: `session/:sessionId/item/:itemId` (`App.tsx:23`). The badge already
  carries `session_id` + `id`, so the target is fully derivable — no extra fetch.
- Keep rows as accessible tappable elements (e.g. `<button>` inside `<li>`, or `role`/keyboard)
  to preserve the existing a11y posture of the component.

**Q3 — `mode` values + display wording**
- `mode` is `"house" | "sale"` (the `Mode` type, `NewSession.tsx:15`; column is `string` in db).
- Existing user-facing wording: ItemCard surfaces sale via the `#receipt` prefix rather than
  the literal word. Mode cards in NewSession read "House Visit" / "Sale Cataloging"
  (`NewSession.tsx:207,227`). For a compact badge row, displaying the raw `mode` ("house"/"sale")
  is acceptable, but to match repo tone prefer "House" / "Sale". Keep it short — the dropdown is `w-56`.

**Q4 — existing test + mock shape**
- Test file: **`src/tests/blocked-badge.test.tsx`**. The "opens a blocked-items detail list on
  click/tap" test (`blocked-badge.test.tsx:102-119`) currently asserts the UUID text (`item-aaa`,
  `item-bbb`) appears. **This assertion will need updating** when rows stop rendering bare ids.
- Supabase mock (`blocked-badge.test.tsx:15-41`): `vi.hoisted` `setBlocked(rows)` controls the
  rows; `vi.mock("../lib/supabase", ...)`. Rows are typed `{ id, mode, session_id }` — the
  planner must **extend the mock row type + `setBlocked` calls to include `title`** (and
  `receipt_number` if used).
- **No router mock today** — the component doesn't navigate yet. The planner must add a
  react-router mock. Use the proven pattern from `new-session-import-rollback.test.tsx:44-47`:
  `vi.mock("react-router", async () => ({ ...await vi.importActual("react-router"),
  useNavigate: () => mockNavigate }))`, then render the badge inside `<MemoryRouter>`.

### TDD test spec (F1) — extend `blocked-badge.test.tsx`
- Add `title` (and optional `receipt_number`) to the hoisted mock row type and `setBlocked` calls.
- Add a `mockNavigate` (hoisted) + react-router mock + `MemoryRouter` wrapper.
- RED tests:
  1. Detail rows show `title` when present (e.g. set `title: "Brass Lamp"`, assert
     `detail` has text "Brass Lamp", and assert the bare UUID is NOT shown).
  2. A `title: null` row renders the fallback (receipt `#R123` or short-id), **never** a raw UUID.
  3. Tapping a row calls `mockNavigate` with `/session/${session_id}/item/${id}`.
  4. Tapping a row closes the dropdown (`blocked-queue-detail` no longer in document).
- Update the existing `item-aaa`/`item-bbb` assertion (lines 117-118) to the new render shape.

---

## Fix 2 (F4/U2) — duplicate-receipt import names the offending receipt

### Approach
Bind the catch (`} catch (err) {`), track the in-flight receipt in a `let currentReceipt`
before each `createBlankItem`, and on a 23505 build a specific message naming that receipt;
otherwise keep the existing generic message. Both branches must retain the retry callback.

### Resolved answers

**Q1 — error shape on 23505**
- Throw path: `createBlankItem` (`db/items.ts:19-27`) → `sessionStore.createItem`
  (`sessionStore.ts:305`). On the Supabase insert error it does `if (error) throw error`
  (`sessionStore.ts:353`). For a non-network error it reverts the optimistic add
  (`sessionStore.ts:393-401`) then **`throw err`** (`sessionStore.ts:408`) — re-throwing the
  original PostgrestError.
- The thrown object is the supabase-js **PostgrestError**, which carries `.code`. For a unique
  violation `.code === "23505"`. **The existing test already encodes this contract**:
  `new-session-import-rollback.test.tsx:129-131` constructs `Object.assign(new Error("duplicate
  key value"), { code: "23505" })`. So detection should be **`error.code === '23505'`** (cast
  through `unknown`/a small type guard, since `catch` binds `unknown` under TS).
- The NewSession.tsx:136-140 comment is **accurate**: `createItem` reverts + throws on the
  non-network 23505 (vs. `updateItemField` which historically swallowed it), so the duplicate
  reaches `handleImport`'s catch and triggers rollback. Confirmed against `sessionStore.ts:372-408`.

**Q2 — capturing the offending receipt**
- Loop: `for (const receipt of receipts)` (`NewSession.tsx:135`). The failing receipt is the
  loop variable at throw time. **Cheapest capture: a `let lastReceipt: string | undefined`
  assigned at the top of each iteration** (before the `await createBlankItem`). On catch,
  `lastReceipt` holds the colliding receipt. Re-deriving from `createdItemIds.length` is
  fragile (off-by-one, no receipt text) — use the `let`.
- **Only ONE receipt collides per failure** — confirmed: the loop `await`s and throws on the
  first failing `createBlankItem`, so iteration stops. No need to collect multiple.
- **Internal CSV duplicates are pre-filtered** before `handleImport`: `parseReceiptNumbers`
  uses a `seen` Set and counts in-file dupes into `skipped` (`importReceipts.ts:17,31-36`).
  So a 23505 can only mean the receipt **already exists in the DB from a prior session** — the
  message should communicate that ("already used"), not "duplicate in your file". The plural
  ("receipt number(s)") in the goal is moot: it is always exactly one. Word it singular.

**Q3 — existing test for the failure toast**
- File: **`src/tests/new-session-import-rollback.test.tsx`**.
- The 23505 case is `"CR-02: duplicate receipt at creation throws → full rollback"`
  (lines 125-152). It mocks the dup via `mockCreateBlankItem.mockResolvedValueOnce("item-1")
  .mockRejectedValueOnce(dupErr)` where `dupErr` has `code: "23505"` (lines 132-134).
  TEST_RECEIPTS = `["R1","R2","R3"]` (line 60), so the second receipt **"R2"** is the collider.
- It currently asserts the **generic** message (lines 148-151):
  `notifyError("Import didn't finish — changes were undone. Try again.", expect.any(Function))`.
  The planner will **change this assertion** to expect a message containing `"R2"` (e.g.
  `expect.stringContaining("R2")`, still with `expect.any(Function)` retry).
- A separate test (`"rolls back ... on mid-loop failure"`, lines 173-200) mocks a **non-23505**
  `new Error("boom")` and asserts the generic message — **this must keep passing**, proving the
  23505 branch is the only one that changes wording.

**Q4 — `notifyError` signature**
- `notifyError: (message: string, retry?: () => void) => void` (`notificationStore.ts:6,13`).
  The retry callback must be preserved in both branches. For the import, retry =
  `() => handleImport(receipts, skipped)` (matches current `NewSession.tsx:164`).

### TDD test spec (F4) — edit `new-session-import-rollback.test.tsx`
- In the existing CR-02 23505 test (lines 125-152): change the `notifyError` assertion to
  `expect(mockNotifyError).toHaveBeenCalledWith(expect.stringContaining("R2"), expect.any(Function))`.
  (R2 is the collider because item-1 resolves, the 2nd rejects.) Keep the rollback assertions.
- Keep the non-23505 test (lines 173-200) asserting the generic message — guards the branch.
- Optional new RED test: assert the 23505 message also still carries a working retry that
  re-runs the import (mirror lines 220-243).

### Suggested message copy (Claude's discretion; planner may finalize)
`Receipt #R2 is already in use — that import was undone. Remove it and try again.` Keep it one
sentence to match the existing toast tone; keep the retry callback.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting duplicate receipts | Pre-query SELECT to check existence | Catch the Postgres 23505 already thrown | DB unique constraint is the source of truth; a pre-check races and adds a round trip |
| In-file dedup | New dedup pass in handleImport | `parseReceiptNumbers` `seen` Set (already done) | Already pre-filtered into `skipped` |
| Navigation | window.location / manual history | react-router `useNavigate` | Already the repo convention; preserves SPA state |

## Common Pitfalls

### Pitfall 1: Non-23505 errors losing the generic message
**What goes wrong:** Broadening the 23505 branch to catch all errors would name a receipt for
network/unknown failures.
**How to avoid:** Gate strictly on `error.code === '23505'`. Every other error keeps
`"Import didn't finish — changes were undone. Try again."` + retry. The existing `"boom"` test
(lines 173-200) enforces this — do not weaken it.
**Warning sign:** That test going red.

### Pitfall 2: `catch (err)` typing under TS
**What goes wrong:** `err` is `unknown`; `err.code` won't compile.
**How to avoid:** Narrow with a guard, e.g. `(err as { code?: string } | null)?.code === '23505'`
or a tiny `isUniqueViolation(err)` helper. Matches how the test constructs the error.

### Pitfall 3: Badge rendering a UUID fallback
**What goes wrong:** Falling back to `item.id` when `title` is null reintroduces the exact bug.
**How to avoid:** Fallback chain must be title → receipt → short non-UUID label, never the raw id.

### Pitfall 4: Detail panel staying open after navigate
**What goes wrong:** Navigating without `setOpen(false)` leaves the dropdown floating over the
new route until the component unmounts/re-renders.
**How to avoid:** Call `setOpen(false)` in the row onClick before/with `navigate(...)`.

## Runtime State Inventory

Not applicable — no rename/refactor/migration. Pure UI behavior changes, no stored-state,
service-config, OS-registered, secrets, or build-artifact impact. **None — verified: the diff
touches only two component files + two test files; no identifiers persisted anywhere.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react |
| Config file | vitest config in repo (test script `vitest --run`) |
| Quick run command | `npx vitest --run src/tests/blocked-badge.test.tsx src/tests/new-session-import-rollback.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| F1/U1 | Badge rows show name + mode, no UUID | unit | `npx vitest --run src/tests/blocked-badge.test.tsx` | ✅ (extend) |
| F1/U1 | Tap row navigates to item route + closes panel | unit | same | ✅ (add router mock) |
| F4/U2 | 23505 names the offending receipt in toast | unit | `npx vitest --run src/tests/new-session-import-rollback.test.tsx` | ✅ (edit assertion) |
| F4/U2 | Non-23505 keeps generic message + retry | unit | same | ✅ (existing, must stay green) |

### Sampling Rate
- **Per task commit:** the two-file quick run above.
- **Per wave / phase gate:** `npm test` green before `/gsd:verify-work`.

### Wave 0 Gaps
- None — both target test files exist. Work is RED-extend, not net-new infra. The only setup
  step is adding the react-router `useNavigate` mock + `MemoryRouter` wrapper to
  `blocked-badge.test.tsx` (copy the pattern from `new-session-import-rollback.test.tsx:44-47,77`).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No new input; receipts already validated by `isValidReceiptNumber` |
| V4 Access Control | no | Same RLS-gated supabase reads/writes; no new endpoints |
| V6 Cryptography | no | None |

No new threat surface: F1 reads an already-authorized query and adds a client route nav;
F4 only formats an error already raised by the DB. No user-supplied string is rendered as HTML
(React escapes the receipt text in the toast).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F1/U1 | Blocked badge shows readable item info + tap-to-navigate | title column + `useNavigate` + item route all confirmed; test mock extensions specified |
| F4/U2 | Duplicate-receipt import names the offending receipt | 23505 `.code` propagation traced; single-collider invariant confirmed; test edit specified |

## Scope Assessment

**Confirmed one-plan.** Two files of production code (`BlockedQueueBadge.tsx`,
`NewSession.tsx`), two test files extended. No schema, no deps, no cross-app impact, no
migration. Nothing surfaced that turns this bigger than a single plan. The only mild "extra"
is adding a router mock to the badge test, which is a copy-paste of an existing pattern.

## Sources

### Primary (HIGH confidence) — all in-repo
- `src/components/BlockedQueueBadge.tsx` — current render + fetch shape
- `src/pages/NewSession.tsx:103-169` — handleImport, catch, notifyError usage
- `src/db/items.ts` + `src/stores/sessionStore.ts:305-409` — createItem throw path (23505 → `throw err`)
- `src/db/database.types.ts:340-364` — items Row columns (`title`, `receipt_number`, `mode`)
- `src/components/ItemCard.tsx:113-127` — canonical display name + fallback pattern
- `src/utils/importReceipts.ts:17-39` — in-file dedup into `skipped`
- `src/layouts/AppLayout.tsx:2,85-86` — react-router import path, badge mount
- `src/App.tsx:23` — item route
- `src/stores/notificationStore.ts` — notifyError signature
- `src/tests/blocked-badge.test.tsx`, `src/tests/new-session-import-rollback.test.tsx` — test mocks

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH — no external deps; all APIs read from source.
- Architecture: HIGH — both fixes single-file, behavior traced end to end.
- Pitfalls: HIGH — derived from existing tests that already encode the contracts.

**Research date:** 2026-06-04
**Valid until:** 30 days (stable in-repo behavior)
