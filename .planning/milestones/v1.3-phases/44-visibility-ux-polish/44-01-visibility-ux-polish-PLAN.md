---
phase: 44-visibility-ux-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/BlockedQueueBadge.tsx
  - src/tests/blocked-badge.test.tsx
  - src/pages/NewSession.tsx
  - src/tests/new-session-import-rollback.test.tsx
autonomous: true
requirements: []   # UX phase — no REQUIREMENT IDs mapped; sourced from v1.3 UAT findings F1 + F4
nyquist_compliant: true

must_haves:
  truths:
    # SC1 — BlockedQueueBadge readable + navigable
    - "The blocked-queue detail dropdown shows a human-readable label (title → #receipt → short id) and mode for each item — never a bare UUID"
    - "Tapping a blocked-item row navigates to /session/{session_id}/item/{id} and closes the dropdown"
    # SC2 — duplicate-receipt import names the receipt
    - "A 23505 duplicate-receipt import failure toast names the offending receipt number"
    - "A non-23505 import failure still shows the generic 'Import didn't finish' copy with a retry callback"
  artifacts:
    - path: "src/components/BlockedQueueBadge.tsx"
      provides: "Named, tappable blocked-item rows with react-router navigation"
      contains: "useNavigate"
    - path: "src/pages/NewSession.tsx"
      provides: "23505-aware import failure messaging that names the colliding receipt"
      contains: "23505"
    - path: "src/tests/blocked-badge.test.tsx"
      provides: "RED→GREEN tests for named rows + tap-to-navigate + dropdown close"
      contains: "mockNavigate"
    - path: "src/tests/new-session-import-rollback.test.tsx"
      provides: "23505 toast names R2 + non-23505 keeps generic copy"
      contains: "stringContaining"
  key_links:
    - from: "src/components/BlockedQueueBadge.tsx"
      to: "react-router useNavigate"
      via: "onClick row handler → navigate(`/session/${session_id}/item/${id}`) + setOpen(false)"
      pattern: "navigate\\(`/session/\\$\\{item\\.session_id\\}/item/\\$\\{item\\.id\\}`\\)"
    - from: "src/pages/NewSession.tsx handleImport catch"
      to: "useNotificationStore.notifyError"
      via: "23505 branch names the tracked receipt; else generic copy"
      pattern: "code === ['\"]23505['\"]"
---

<objective>
Two isolated UX fixes from the v1.3 UAT walk. Both are surgical edits to a single
production file each, fully covered by existing test files. No schema, no deps, no
migration, no cross-app impact.

- **SC1 (F1/U1):** `BlockedQueueBadge` dropdown lists raw item UUIDs with no navigation.
  Render a human-readable label (title → `#receipt_number` → short id slice) plus mode,
  and make each row tap-to-navigate to the item, closing the dropdown.
- **SC2 (F4/U2):** A duplicate-receipt (Postgres `23505`) import failure shows generic
  "Import didn't finish" copy. Inspect the caught error and name the single offending
  receipt; every other failure keeps the existing generic message + retry.

Purpose: Make blocked work navigable and import failures actionable — the user can see
*which* item is stuck / *which* receipt collided instead of an opaque UUID or generic toast.
Output: Two edited components + two extended test files; `npm test` green.

STRICTLY IN SCOPE — no refactors, no adjacent improvements. Stay on the four files above.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.3-phases/44-visibility-ux-polish/RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. All read from repo source by RESEARCH — no
     codebase exploration required. -->

react-router v7 (bare "react-router" import path, confirmed AppLayout.tsx:2, NewSession.tsx:2):
- `useNavigate(): (path: string) => void`
- Item route: `session/:sessionId/item/:itemId` (App.tsx:23)

items table columns (database.types.ts):
- `title: string | null`         — display name (createItem inserts null for blanks)
- `receipt_number: string | null`
- `mode: string` ("house" | "sale")
- `session_id: string`, `id: string`

ItemCard display idiom to mirror (ItemCard.tsx:113-127):
- name fallback: `item.title || "— needs title —"`
- sale-with-receipt id line: `#${item.receipt_number}`

notifyError (notificationStore.ts:6,13):
- `notifyError: (message: string, retry?: () => void) => void`

23505 contract (already encoded by the test, new-session-import-rollback.test.tsx:129-131):
- thrown object is a PostgrestError carrying `.code`; unique violation === `"23505"`.
- `catch` binds `unknown` under TS — narrow with `(err as { code?: string } | null)?.code`.

Existing test patterns to reuse:
- react-router mock (new-session-import-rollback.test.tsx:44-47):
  `vi.mock("react-router", async () => ({ ...await vi.importActual("react-router"), useNavigate: () => mockNavigate }))`
- `<MemoryRouter>` render wrapper (same file, lines 75-81)
- blocked-badge supabase mock + `setBlocked(rows)` (blocked-badge.test.tsx:14-41)
</interfaces>
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1 (SC1): BlockedQueueBadge — named, tappable, navigating rows</name>
  <files>src/components/BlockedQueueBadge.tsx, src/tests/blocked-badge.test.tsx</files>
  <read_first>
    - src/components/BlockedQueueBadge.tsx (full file — fetch select, BlockedItem interface, <li> render, setOpen)
    - src/tests/blocked-badge.test.tsx (supabase mock shape lines 14-41; existing detail test lines 102-119)
    - src/tests/new-session-import-rollback.test.tsx:44-47,75-81 (react-router mock + MemoryRouter pattern to copy)
  </read_first>
  <behavior>
    RED tests to add/extend in blocked-badge.test.tsx (extend the hoisted mock row type
    and every `setBlocked` call with `title` and `receipt_number`; add a hoisted
    `mockNavigate`, the react-router mock, and wrap renders in `<MemoryRouter>`):
    - Row with `title: "Brass Lamp"` renders text "Brass Lamp" in the detail panel AND the
      bare UUID does NOT appear.
    - Row with `title: null`, `receipt_number: "R123"` renders `#R123` (fallback), never the raw id.
    - Row with `title: null`, `receipt_number: null` renders a short id slice (NOT the full UUID).
    - Each row shows its mode (e.g. "House" / "Sale").
    - Tapping a row calls `mockNavigate` with `/session/${session_id}/item/${id}`.
    - Tapping a row closes the dropdown (`blocked-queue-detail` no longer in document).
    - Update the existing item-aaa/item-bbb assertion (lines 117-118) to the new render shape
      (those ids must NOT render bare).
  </behavior>
  <action>
    In `BlockedQueueBadge.tsx`:
    - Extend the `BlockedItem` interface with `title: string | null` and `receipt_number: string | null`.
    - Add `title, receipt_number` to the `fetchBlockedItems` select — final:
      `.select("id, mode, session_id, title, receipt_number")`. Keep the `.eq("ai_status","failed")`
      filter and the `data as BlockedItem[]` cast unchanged.
    - Import `useNavigate` from `"react-router"` (bare path, per AppLayout.tsx:2); call it at the
      top of the component: `const navigate = useNavigate();`.
    - Compute a per-row display label with the fallback chain (mirror ItemCard.tsx:127 idiom):
      `item.title` → else `#${item.receipt_number}` when receipt present → else a short id slice
      (e.g. `item.id.slice(0, 8)`). NEVER fall back to the bare `item.id` (Pitfall 3).
    - Render each `<li>` as a tappable element (a `<button type="button">` inside the `<li>`, full-width,
      left-aligned) showing the label + a compact mode tag ("House"/"Sale"; map `mode === "sale" ? "Sale" : "House"`).
      onClick: `setOpen(false); navigate(`/session/${item.session_id}/item/${item.id}`);` (Pitfall 4 — close on nav).
    - Keep the existing `tone="err"` Badge, the `data-testid="blocked-queue-detail"` `<ul>` container,
      its classes, and all aria attributes. Keep `key={item.id}`. Do NOT change the count/toggle logic.
    Commit atomically: RED `test(44): blocked badge renders named rows + navigates on tap`, then
    GREEN `feat(44): blocked-queue badge shows named, tappable, navigating rows`.
  </action>
  <verify>
    <automated>npx vitest --run src/tests/blocked-badge.test.tsx</automated>
  </verify>
  <done>
    All blocked-badge tests pass. Detail rows render title/receipt/short-id + mode (never a bare UUID);
    tapping a row navigates to the item route and closes the dropdown. AppLayout mount test still green.
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2 (SC2): NewSession import — 23505 names the offending receipt</name>
  <files>src/pages/NewSession.tsx, src/tests/new-session-import-rollback.test.tsx</files>
  <read_first>
    - src/pages/NewSession.tsx:103-169 (handleImport: loop at 135, catch at 148, notifyError at 160-165)
    - src/tests/new-session-import-rollback.test.tsx:125-152 (CR-02 23505 test; collider is "R2" — item-1 resolves, 2nd rejects)
    - src/tests/new-session-import-rollback.test.tsx:173-200 (non-23505 "boom" test — must stay green, asserts generic copy)
  </read_first>
  <behavior>
    Edits in new-session-import-rollback.test.tsx:
    - CR-02 23505 test (lines 148-151): change the `notifyError` assertion from the generic string to
      `expect(mockNotifyError).toHaveBeenCalledWith(expect.stringContaining("R2"), expect.any(Function))`.
      Keep all rollback assertions (deleteItem/deleteSession reverse order, no navigate) unchanged.
    - Non-23505 "boom" test (lines 195-198): leave asserting the exact generic
      `"Import didn't finish — changes were undone. Try again."` + `expect.any(Function)` — guards the branch (Pitfall 1).
    - (Optional) extend the retry test to confirm the 23505 branch still carries a working retry.
  </behavior>
  <action>
    In `NewSession.tsx` `handleImport`:
    - Declare `let lastReceipt: string | undefined;` alongside `createdItemIds` (before the try), and assign
      `lastReceipt = receipt;` at the top of each loop iteration, BEFORE `await createBlankItem(...)`
      (RESEARCH Q2 — the loop variable at throw time is the single collider).
    - Change `} catch {` (line 148) to `} catch (err) {`. Keep the existing reverse-order compensating
      deletes (deleteItem then deleteSession) exactly as-is.
    - After the rollback deletes, narrow the error: `const isDup = (err as { code?: string } | null)?.code === "23505";`
      (Pitfall 2). Gate strictly on `=== "23505"` (Pitfall 1).
    - If `isDup`: call `notifyError` with a message that NAMES `lastReceipt` (singular — internal CSV dupes
      are pre-filtered to `skipped`, so exactly one prior-session collider), e.g.
      `Receipt #${lastReceipt} is already in use — that import was undone. Remove it and try again.`,
      with the SAME retry callback `() => handleImport(receipts, skipped)`.
    - Else: keep the EXISTING generic call verbatim —
      `notifyError("Import didn't finish — changes were undone. Try again.", () => handleImport(receipts, skipped))`.
    Do NOT touch the offline-refusal branch, the happy-path navigate, or the `finally`.
    Commit atomically: RED `test(44): import 23505 toast names the offending receipt`, then
    GREEN `feat(44): name the colliding receipt on a 23505 duplicate import`.
  </action>
  <verify>
    <automated>npx vitest --run src/tests/new-session-import-rollback.test.tsx</automated>
  </verify>
  <done>
    23505 test asserts the toast contains "R2" + retry; non-23505 "boom" test still asserts the generic
    copy + retry. All other rollback / offline / happy-path tests stay green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Postgres (Supabase) → client | 23505 unique-violation error crosses into `handleImport`'s catch; client only inspects `.code` and formats a message |
| DB row → DOM | blocked-item `title` / `receipt_number` rendered into the dropdown (React-escaped) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-44-01 | Information Disclosure | BlockedQueueBadge row label | accept | Renders only `title`/`receipt_number`/short-id of already-authorized (RLS-gated) rows the user can see; no new query surface |
| T-44-02 | Tampering | import error message | mitigate | Gate strictly on `code === "23505"`; receipt text is React-escaped in the toast (no HTML injection), validated upstream by `isValidReceiptNumber` |
| T-44-SC | Tampering | npm/pip/cargo installs | n/a | No package installs in this phase — zero new dependencies (RESEARCH: "No new packages") |
</threat_model>

<verification>
- `npx vitest --run src/tests/blocked-badge.test.tsx src/tests/new-session-import-rollback.test.tsx` — both files green.
- `npm test` — full suite green (no regression in the rollback / offline / happy-path tests).
- Manual confirm of intent: blocked dropdown shows no bare UUIDs; a 23505 import names a receipt.
</verification>

<success_criteria>
1. (SC1) The `BlockedQueueBadge` detail dropdown shows human-readable item info (name/mode) and
   navigates to the item on tap, instead of bare UUIDs.
2. (SC2) A `23505` duplicate-receipt import surfaces the specific offending receipt number in the
   failure toast, not the generic copy; every non-23505 failure keeps the generic copy + retry.
</success_criteria>

<output>
Create `.planning/milestones/v1.3-phases/44-visibility-ux-polish/44-01-SUMMARY.md` when done.
</output>
