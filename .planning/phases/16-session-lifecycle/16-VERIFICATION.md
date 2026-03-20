---
phase: 16-session-lifecycle
verified: 2026-03-20T18:30:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Specialist Submit Flow"
    expected: "Log in as specialist, open active session, tap Submit for Review, confirm in dialog — session moves to Submitted, blue banner appears, all fields become read-only, Add Item button disappears"
    why_human: "Role-based conditional rendering and read-only state gating cannot be verified by static analysis alone"
  - test: "Pre-Submit Gate"
    expected: "Open active session with queued items — Submit button is disabled and shows processing count text"
    why_human: "Requires live AI processing queue state to test the queuedCount > 0 guard"
  - test: "Admin Review Flow"
    expected: "Log in as admin, see Awaiting Review section on Sessions page, open submitted session — all item fields are editable, Export and Return to Specialist buttons visible in header"
    why_human: "Role switching and admin-only button visibility requires live session with correct status"
  - test: "Admin Return Flow"
    expected: "Tap Return to Specialist on submitted session — ReturnDialog opens, type review notes, confirm — session status changes to Returned"
    why_human: "ReturnDialog interaction, Supabase write of review_notes, and status transition require runtime verification"
  - test: "Specialist Returned Session — Sticky Banner"
    expected: "Log in as specialist, open returned session — sticky amber banner shows with admin's review notes, editing is restored (Add Item and notes textarea visible)"
    why_human: "Sticky positioning behavior on mobile scroll and review_notes content display require device testing"
  - test: "Admin Export Flow with Confirmation"
    expected: "As admin, tap Export Session — confirmation dialog appears, confirm — JSON downloads with versioned filename, session status changes to Exported"
    why_human: "File download trigger and status update after download cannot be asserted statically"
  - test: "Export Gating — Specialist"
    expected: "As specialist, open any session — Export Session button is completely absent from the page"
    why_human: "Absence of a DOM element requires runtime role resolution to confirm"
  - test: "Sessions Page Sections Match Role"
    expected: "Specialist sees: Needs Attention (amber, returned sessions), Active Sessions, Submitted (collapsible), Exported (collapsible). Admin sees: Awaiting Review, Active Sessions, Returned (collapsible), Exported (collapsible)"
    why_human: "Role-aware section rendering requires login as each role and visual inspection"
  - test: "SessionCard Status Pills"
    expected: "Submitted=yellow pill, Returned=orange pill, Exported=green pill — visible on session cards in their respective sections"
    why_human: "Color rendering and conditional pill display require visual inspection"
  - test: "Admin Reopen Exported Session"
    expected: "As admin, open exported session — Reopen Session button visible in header area; tap it, confirm — session returns to active status"
    why_human: "UAT-driven addition; status reversal and button visibility require runtime verification"
---

# Phase 16: Session Lifecycle Verification Report

**Phase Goal:** Submit, review, return, and admin-only export workflow
**Verified:** 2026-03-20T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test stubs exist for all six LIFE requirements and run without errors | VERIFIED | `src/tests/session-lifecycle.test.tsx` — 18 `it.todo` stubs across all 6 LIFE requirements |
| 2 | Stub tests are marked todo so the suite stays green | VERIFIED | All tests use `it.todo()`, zero live assertions; suite runs green |
| 3 | Sessions page shows role-aware lifecycle sections (specialist and admin) | VERIFIED | `Sessions.tsx` L374–507: `isAdmin` conditional renders "Needs Attention / Active / Submitted / Exported" for specialist and "Awaiting Review / Active / Returned / Exported" for admin |
| 4 | SessionCard displays status pills for non-active sessions | VERIFIED | `SessionCard.tsx` L142–155: two pill branches using `statusColors`/`statusLabels` maps; yellow=submitted, orange=returned, green=exported |
| 5 | Sections only render when they contain at least one session | VERIFIED | All sections guarded by `filteredX.length > 0 &&` or `renderAdminSection` returning null when `sessions.length === 0` |
| 6 | Needs Attention section header uses amber color with warning icon | VERIFIED | `Sessions.tsx` L389: `text-amber-600 dark:text-amber-400` with warning SVG icon |
| 7 | SessionDetail specialist can submit an active session with gate and confirmation | VERIFIED | `SessionDetail.tsx` L333–348: Submit button gated by `queuedCount > 0`, `setConfirmAction('submit')` on click; ConfirmDialog L579–587 |
| 8 | Submitted sessions are read-only for specialist; admin is never locked | VERIFIED | `SessionDetail.tsx` L179–180: `isLifecycleLocked = isSpecialist && status === 'submitted'`; `isReadOnly` applied to name, notes, ItemList, Add Item button |
| 9 | Admin sees Export and Return to Specialist in header; specialist sees neither | VERIFIED | `SessionDetail.tsx` L351–385: Export gated `{isAdmin && ...}`, Return gated `{isAdmin && session.status === 'submitted' && ...}`; specialist only sees Submit |
| 10 | Returning a session opens ReturnDialog, saves review_notes, changes status to 'returned' | VERIFIED | `SessionDetail.tsx` L376–385: button opens dialog; `handleReturn` L242–248 calls `storeUpdateSession` with `status: 'returned', review_notes` |
| 11 | Returned sessions show sticky amber banner with review notes for specialist | VERIFIED | `SessionDetail.tsx` L414–428: `sticky top-0 z-20` amber banner; renders `session.review_notes` when truthy |
| 12 | Export sets session status to 'exported' after JSON download | VERIFIED | `SessionDetail.tsx` L212–222: `handleExport` awaits `exportSession()` then `storeUpdateSession({status: 'exported'})` |
| 13 | Export is admin-only; status type includes all lifecycle statuses | VERIFIED | Export button `{isAdmin && ...}`; `export.ts` L105: `status as "active" \| "submitted" \| "returned" \| "exported"`; `types.ts` L5: same union |
| 14 | Old Mark Complete and Reopen Session (old) buttons removed | VERIFIED | No matches for `Mark Complete` or `session.status === "completed"` in src/ |
| 15 | useCompletedSessions and useArchivedSessions fully removed | VERIFIED | Zero matches for either export in entire src/ tree |

**Score:** 10/10 structural/wiring must-haves verified (human tests pending for runtime behavior)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/tests/session-lifecycle.test.tsx` | Stub tests for LIFE-01 through LIFE-06 | VERIFIED | 18 `it.todo` stubs across 6 describe blocks |
| `src/tests/return-dialog.test.tsx` | Stub tests for ReturnDialog | VERIFIED | 5 `it.todo` stubs |
| `src/tests/use-user-role.test.ts` | Stub tests for useUserRole | VERIFIED | 6 `it.todo` stubs |
| `src/hooks/useUserRole.ts` | Role detection hook querying profiles table | VERIFIED | Queries `profiles.role`, returns `{ role, isAdmin, loading }` |
| `src/hooks/useSessions.ts` | Lifecycle-aware session filter hooks | VERIFIED | Exports `useSubmittedSessions`, `useReturnedSessions`, `useExportedSessions`; no `useCompletedSessions` |
| `src/components/SessionCard.tsx` | Status pills for non-active sessions | VERIFIED | `statusColors`/`statusLabels` maps; yellow/orange/green pills |
| `src/pages/Sessions.tsx` | Role-aware lifecycle sections | VERIFIED | Specialist + admin branch with correct section order |
| `src/components/ReturnDialog.tsx` | Modal with textarea for return notes | VERIFIED | `createPortal`, `textarea`, amber confirm button, `Keep Submitted` cancel |
| `src/pages/SessionDetail.tsx` | Complete lifecycle UI | VERIFIED | Submit/Export/Return in header; banners; isLifecycleLocked read-only; Delete at bottom only |
| `src/utils/export.ts` | Export with status type including all lifecycle statuses | VERIFIED | Status cast updated; `reExportSession` alias for re-export capability |
| `src/db/types.ts` | Session interface with all lifecycle statuses | VERIFIED | `status: "active" \| "submitted" \| "returned" \| "exported"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Sessions.tsx` | `useUserRole.ts` | `useUserRole()` at page level | WIRED | L211: `const { isAdmin, loading: roleLoading } = useUserRole()` |
| `Sessions.tsx` | `useSessions.ts` | lifecycle filter hooks | WIRED | L8: `useSubmittedSessions`, `useReturnedSessions`, `useExportedSessions` imported and called L208–210 |
| `SessionCard.tsx` | `session.status` | status pill conditional rendering | WIRED | L149: `session.status !== 'active'` pill conditional |
| `SessionDetail.tsx` | `useUserRole.ts` | `useUserRole()` for role-based button rendering | WIRED | L5: import; L90: `const { isAdmin, loading: roleLoading } = useUserRole()` |
| `SessionDetail.tsx` | `sessionStore.ts` | `updateSession` for status transitions | WIRED | L53: `storeUpdateSession`; used for `submitted`, `returned`, `exported`, `active` transitions |
| `SessionDetail.tsx` | `ReturnDialog.tsx` | ReturnDialog component for admin return flow | WIRED | L11: import; L623–628: `<ReturnDialog open={showReturnDialog} ... onConfirm={handleReturn}>` |
| `SessionDetail.tsx` | `export.ts` | `exportSession` call gated by `isAdmin` | WIRED | L351–373: Export button `{isAdmin && ...}`; L215: `await exportSession(sessionId!)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIFE-01 | 16-00, 16-01, 16-02 | Specialist can submit a completed session to admin for review | SATISFIED | Submit button in SessionDetail header (specialist-only, active/returned sessions); ConfirmDialog with "Lock & Submit"; `storeUpdateSession({status: 'submitted'})` |
| LIFE-02 | 16-00, 16-01, 16-02 | Submitted sessions are locked for the specialist (read-only unless returned) | SATISFIED | `isLifecycleLocked = isSpecialist && status === 'submitted'`; `isReadOnly` gates name edit, notes textarea, ItemList, Add Item float button |
| LIFE-03 | 16-00, 16-01, 16-02 | Admin can edit item fields directly on submitted sessions | SATISFIED | `isReadOnly` only locks specialist; admin never sets `isLifecycleLocked`; ItemList passes `readOnly={isReadOnly}` which is false for admin |
| LIFE-04 | 16-00, 16-01, 16-02 | Admin can return a submitted session to the specialist with review notes | SATISFIED | "Return to Specialist" button in header (admin + submitted); ReturnDialog with textarea; `handleReturn` saves `review_notes` + `status: 'returned'` |
| LIFE-05 | 16-00, 16-01, 16-02 | Returned sessions show review notes to the specialist | SATISFIED | Sticky amber banner in SessionDetail for `status === 'returned' && isSpecialist`; renders `session.review_notes`; `z-20 sticky top-0` positioning |
| LIFE-06 | 16-00, 16-01, 16-02 | Only admin can export session data as JSON | SATISFIED | Export button gated `{isAdmin && ...}` — completely absent from specialist view; export sets `status: 'exported'`; Sessions page "Exported" section shows post-export state |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/tests/session-lifecycle.test.tsx` | All | All 18 tests are `it.todo()` — no filled-in assertions | Info | Expected per Phase 16 design (Wave 0 scaffolding). LIFE behaviors are verified via wiring analysis and UAT (Plan 03), not automated unit tests. Test fill-in is planned for a future phase. |
| `src/tests/return-dialog.test.tsx` | All | All 5 tests are `it.todo()` | Info | Same as above |
| `src/tests/use-user-role.test.ts` | All | All 6 tests are `it.todo()` | Info | Same as above |

No blocker or warning anti-patterns found in production code.

### Human Verification Required

#### 1. Specialist Submit Flow

**Test:** Log in as specialist, open an active session, tap "Submit for Review", confirm in the dialog.
**Expected:** Session moves to Submitted section on Sessions page; blue "awaiting admin review" banner appears; all item fields, notes, and name are read-only; Add Item button disappears.
**Why human:** Role-based conditional rendering and DOM state gating require runtime role resolution and visual inspection.

#### 2. Pre-Submit Gate

**Test:** Open an active session that has items in `ai_status === 'queued'` state.
**Expected:** Submit button is disabled and shows `"N items still processing"` instead of "Submit for Review".
**Why human:** Requires live AI processing queue state — cannot be asserted statically.

#### 3. Admin Review Flow

**Test:** Log in as admin, verify the "Awaiting Review" section is present on Sessions page, open a submitted session.
**Expected:** All item fields and session notes are editable; "Export Session" and "Return to Specialist" buttons are visible in the header area; Submit button is absent.
**Why human:** Role-switching and admin-only visibility require live authentication.

#### 4. Admin Return Flow

**Test:** As admin on a submitted session, tap "Return to Specialist", type review notes in the dialog, confirm.
**Expected:** ReturnDialog opens with textarea; confirming saves notes to `review_notes` and changes status to "Returned"; session moves to Returned section on Sessions page.
**Why human:** Supabase write of `review_notes`, optimistic state update, and status transition require runtime verification.

#### 5. Specialist Returned Session — Sticky Banner

**Test:** Log in as specialist, open a returned session (one with review notes).
**Expected:** Sticky amber "Returned by Admin" banner pinned at top while scrolling; displays the admin's review notes text; notes textarea and Add Item button are restored (session is editable again).
**Why human:** Sticky scroll behavior on mobile requires device testing; `review_notes` content display requires data with non-null notes.

#### 6. Admin Export Flow with Confirmation

**Test:** As admin, tap "Export Session" on any session.
**Expected:** Confirmation dialog appears before download; confirming downloads a versioned `.json` file; session status changes to "Exported" and moves to Exported section.
**Why human:** File download trigger (`a.click()`) and post-download status update cannot be asserted via static analysis.

#### 7. Export Gating — Specialist

**Test:** Log in as specialist, open sessions in any status.
**Expected:** "Export Session" button is completely absent from the page in all lifecycle states.
**Why human:** Absence of a DOM element requires runtime rendering to confirm.

#### 8. Sessions Page Sections Match Role

**Test:** Log in as each role and inspect the Sessions page section layout.
**Expected:** Specialist: Needs Attention (amber header, warning icon, returned sessions), Active Sessions, Submitted (collapsible expanded), Exported (collapsible collapsed). Admin: Awaiting Review, Active Sessions, Returned (collapsible), Exported (collapsible) — all with specialist sub-groupings.
**Why human:** Role-aware conditional rendering and section ordering require visual inspection as each role.

#### 9. SessionCard Status Pills

**Test:** Observe session cards across all lifecycle sections.
**Expected:** Submitted sessions show yellow "Submitted" pill; returned sessions show orange "Returned" pill; exported sessions show green "Exported" pill; active sessions show no lifecycle pill.
**Why human:** Color rendering and conditional pill visibility require visual inspection.

#### 10. Admin Reopen Exported Session

**Test:** As admin, open an exported session.
**Expected:** "Reopen Session" button is visible in the header area; tapping it shows a confirmation dialog; confirming changes status back to "active" and moves session to Active Sessions section.
**Why human:** UAT-driven feature added in Plan 03; status reversal and button placement require runtime verification.

### Gaps Summary

No structural gaps found. All artifacts exist, are substantive, and are correctly wired. All 6 LIFE requirements are satisfied by the implementation.

The test stubs (`it.todo`) are intentionally unfilled — this was the explicit design of the Wave 0 scaffolding approach in Plan 00. The lifecycle behaviors are verified through wiring analysis and the Plan 03 UAT checkpoint (8 scenarios + 3 UAT fixes). Automated unit tests for these behaviors are a deferred concern for a future phase.

The phase goal — "Submit, review, return, and admin-only export workflow" — is structurally complete. All lifecycle state transitions, role gates, read-only locks, status banners, and export controls are implemented and wired. Human verification of runtime behavior is required to confirm the goal is fully achieved end-to-end.

---

_Verified: 2026-03-20T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
