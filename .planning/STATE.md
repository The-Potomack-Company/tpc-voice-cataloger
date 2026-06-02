---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Maturation — Phases
status: executing
stopped_at: Phase 38 UI-SPEC approved
last_updated: "2026-06-02T16:11:40.029Z"
progress:
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-29)

**Core value:** Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing -- with entries flowing directly into RFC Invaluable.
**Current focus:** Phase 35 — ai-correctness-track-2

## Current Position

Phase: 37
Plan: 03 complete (a11y-foundation: OverflowMenu ⋯ wired into 3 rows via existing delete path + 44px trigger + keyboard-only axe e2e gate)
Milestone: v1.3 Maturation — IN PROGRESS (opened 2026-05-29); 4/10 phases done (31, 32, 33, 34)
Status: Ready to execute
Predecessor: v1.2 UI Overhaul — SHIPPED 2026-05-13 (PR #11)
Successor: ../tpc-hub (v3.0-hub-merge milestone) — DEFERRED (D-052)
Work policy: feature + hardening work allowed in-repo (D-052); /tpc-urgent still used for prod regressions

Progress: [████░░░░░░] 40%

Next action: Phase 34 (ios-memory-optimization) COMPLETE — PERF-1 chunked base64 encoder (CR-01 iOS-JSC arg-spread crash found in code review + fixed, commit f655226), PERF-3 ItemList aggregate hoist + React.memo ItemCard (~4N subscriptions → 1; render-count test green), PERF-2 deferred (D-04/D-050). Phase 35 (ai-correctness-track-2) is next — `/gsd-discuss-phase 35` then plan/execute. Deferred to v1.3 milestone end: branch push + on-device UAT batch — now owes **two** HUMAN-UAT files (`33-HUMAN-UAT.md` 3 items + `34-HUMAN-UAT.md` 1 item: iOS memory smoke). All v1.3 work on branch **`gsd/v1.3-maturation`** (off origin/main `11b0ee2`); `main` clean. Branch still UNPUSHED.

## v1.3 Phase Queue

Source: `docs/audit-consolidated-backlog-2026-05-27.md` + 2026-05-28 UAT + audio-blob ask. Full detail in `.planning/ROADMAP.md`.

| Phase | Slug | Priority | Planned |
|-------|------|----------|---------|
| 31 | sec-profiles-self-update-hardening | ✅ DONE (applied to prod 2026-05-29) | yes (2/2 executed) |
| 32 | audio-blob-supabase-persistence | 🟠 NEW | no |
| 33 | offline-reliability | 🟠 REL-1..4 | no |
| 34 | ios-memory-optimization | ✅ DONE (PERF-1/3 shipped; PERF-2 deferred D-04) | yes (3/3 executed) |
| 35 | ai-correctness-track-2 | 🟡 | no |
| 36 | ux-visibility-polish | 🟡 | no |
| 37 | a11y-foundation | 🟡 | no |
| 38 | migration-retryability | 🟡 (was 999.2) | no |
| 39 | optimistic-locking | 🔴 HIGH RISK (was 999.3) | no |
| 40 | ai-proxy-cloud-run-migration | 🟠 cross-app (NEW) | no |

## Performance Metrics

**v1.2 UI Overhaul:** SHIPPED 2026-05-13 (PR #11, single mega-PR — phases 22-30). Sample plan metrics from Phase 22:

| Phase | Plan | Duration | Tasks | Files | Date |
|-------|------|----------|-------|-------|------|
| 22 | 01 | 7 min | 3 | 5 | 2026-04-30 |
| 22 | 04 | 5 min | 1 | 1 | 2026-04-30 |

**Historical (v1.0 + v1.1 combined):**

- Total plans completed: 71
- Total commits: 475
- Timeline: 25 days (2026-03-06 -> 2026-03-31)
- LOC delta: 33,636 (TS/TSX/JS) at v1.1 close

| Phase 31 P01 | 8 min | 2 tasks | 2 files |
| Phase 32 P01 | 18min | 3 tasks | 8 files |
| Phase 32 P04 | 6min | 3 tasks | 5 files |
| Phase 32 P05 | 4min | 2 tasks | 3 files |
| Phase 33 P02 | 5 min | 1 tasks | 2 files |
| Phase 34 P00 | 1 min | 2 tasks | 2 files |
| Phase 36 P01 | ~10 min | 2 tasks | 5 files |
| Phase 36 P02 | ~12 min | 2 tasks | 5 files |
| Phase 36 P03 | ~5 min | 2 tasks | 8 files |
| Phase 37 P01 | ~9 min | 3 tasks | 6 files |
| Phase 37 P02 | ~10 min | 3 tasks | 7 files |
| Phase 37 P03 | ~12 min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table and the vault (`../_workspace/Decisions/`).

**Phase 22 Plan 04 decisions (2026-04-30, v1.2):**

- Narrow per-file allowlist for the TOKENS-04 guard test itself (D-16 escape hatch — the file IS the fixture: its regex source code contains the literal patterns it scans for). Single-entry `ALLOW_FILES = [src/ui/__tests__/no-hardcoded-literals.test.ts]`; does NOT widen to all of `__tests__`.
- `/// <reference types="node" />` triple-slash directive at the top of `src/ui/__tests__/no-hardcoded-literals.test.ts` to opt only this file into Node typings under `tsconfig.app.json` (which doesn't load `@types/node` by default and includes `src/ui/__tests__/`, unlike `src/tests/` which is excluded).
- [Phase ?]: Phase 32 P01: audio retention cron runs daily 03:00 UTC; cron body POSTs purge-audio edge fn via pg_net (never raw DELETE FROM storage.objects)
- [Phase ?]: Phase 32 P01: purge-audio cron secret + edge fn URL passed via current_setting('app.settings.*') placeholders, substituted at plan-02 prod push — no secret in repo
- [Phase ?]: Phase 32 P01: audio storage RLS uses column-qualified storage.foldername(storage.objects.name)[2]=sessionId from line one (Phase 31 fix baked in)
- [Phase ?]: Phase 32 P04: created standalone src/services/processAudioWithAi.ts blob-resolver (object signature) to match the locked test scaffold; gemini delegates blob resolution to it
- [Phase ?]: Phase 32 P04: audioRecordsForItem unions Supabase audio only when no Dexie row exists (Dexie-authoritative, id undefined) — cross-device-only audio shows count but silent status pill (accepted limitation, W-3 rule a)
- [Phase ?]: Phase 32 P04: completed_at stamped on single-item AI-done write-path only (D-07); continuous-mode write-paths out of scope (D-050)
- [Phase 32]: P05: deleteItem removes audio Storage blobs (storage.from('audio').remove) on hard-delete (D-04); remove failure logged+swallowed, pg_cron purge-audio reaper is the orphan backstop; first storage.remove() in the codebase
- [Phase 32]: P05: ItemCard audio pill labels Pending/Uploaded/Failed-retry satisfy the locked item-card-audio-status.test.tsx regexes (overrides plan Uploading/Saved); failed pill re-enqueues via retryFailedUploads (D-06)
- [Phase ?]: [Phase 33]: P02: REL-2 cross-tab dedup is a DB-atomic conditional claim (.update().eq(id).eq(ai_status,'queued').select('id')); .select('id') mandatory (PostgREST returns null data without it). No message bus (D-03); per-tab draining boolean is local short-circuit only.
- [Phase ?]: [Phase 33]: P02: STALE_MS=300_000; stale 'processing' rows reclaimed to 'queued' at drain start via .eq('ai_status','processing').lt('claimed_at',cutoff) so a dead tab self-heals.
- [Phase 34]: P00: multi-chunk base64 reference oracle builds binary in 8192-byte slices then btoa once (chunk-free) so it cannot share the alignment bug it guards
- [Phase 34]: P00: render-fan-out test mocks useSessionItems to drive ItemList's 3 items; forward-references __itemCardRenderCounts (RED until Plan 02)
- [Phase 36]: P01: toUserMessage (D-09) is the single error-copy funnel — returns exactly one of "Wrong email or password" / "Connection problem — try again" / "Something went wrong"; inlines the network-token set (mirrors sessionStore.isNetworkError) rather than importing it; navigator.onLine===false also maps to the connection string. Raw backend text never reaches the user.
- [Phase 36]: P01: notificationStore.notifyError dedupes identical-current message (D-05, no flicker); ErrorToast gates the 6s auto-dismiss on `message===null || retry!==null` with deps [message, retry] — retryable toasts are sticky (D-06), informational still auto-dismiss. Plans 02/03 import toUserMessage before notifyError.
- [Phase 36]: P03: useDataMigration threads migration.ts result.partial into a distinct "partial" state (SC3/D-07) — a skipped-≥1 run never reaches "complete"; MigrationSplash renders the UI-SPEC partial copy ("Some items couldn't be migrated. Your data is safe."), auto-dismisses like complete, NO Phase-38 retry flow; ProtectedRoute wired for "partial" (Rule 2) else the copy is dead code. useUserRole uses a ROLE_ERROR sentinel (non-"admin" string) to distinguish load-error from not-admin → isAdmin stays false on error (fail closed, ASVS V4), exposes error:boolean, surfaces via notifyError(toUserMessage, retry); not-admin/loading/no-user never notify. offlineQueue.getQueuedItems surfaces read failure via notifyError (informational, no retry) while still returning [] (empty-return contract preserved, T-36-07).
- [Phase 37]: P03: OverflowMenu (⋯) primitive (D-03, hand-rolled, no portal — relative dropdown) wired into ItemCard/SessionTile/SessionCard via the EXISTING delete path (D-04, no new delete logic): ItemCard→setShowDeleteConfirm, SessionTile/Card→onDelete prop; swipe gesture kept (additive). 44px trigger (min-h-11 min-w-11, aria-label/title "More actions", aria-haspopup=menu+aria-expanded); items carry tpc-btn for the A11Y-02 ring, destructive Delete uses --err ink; Escape closes+restores focus to trigger, arrow-key roving, outside-click/Tab close; open/close gated on prefers-reduced-motion. Keyboard-only e2e (tests/e2e/keyboard-flow.spec.ts) + @axe-core/playwright scan on /login (deepest unauthenticated-reachable surface, SC4) — green; authed record→edit→save leg gated behind SUPABASE_URL → UAT-37-01. [Rule 2] Login wrapped in <main> to close pre-existing axe landmark-one-main/region. meta-viewport user-scalable=no (WCAG 1.4.4, app-wide PWA setting) excluded from scan → UAT-37-02. Full suite 682 pass, tsc clean. 37-HUMAN-UAT.md created (2 items).
- [Phase 37]: P02: all 5 modals migrated onto <Modal> (D-02) — ConfirmDialog (8 callers inherit, signature unchanged), ReturnDialog (textarea initialFocusRef), ItemPeekModal (gains role/aria-modal/Escape + 44px close btn — biggest prior gap closed), PhotoLightbox (bareOverlay full-screen, swipe nav kept, nested ConfirmDialog), MigrationSplash (folds trap in directly, opacity fade gated on prefers-reduced-motion, pre-existing TS6133 'skipped' resolved). <Modal> extended with additive overlayClassName/panelClassName/bareOverlay props (defaults preserve centered-card look) so non-centered modals route through it without forking. Nested-trap needs NO explicit stack: sibling portals to document.body, each useFocusTrap keydown bound to its own panel → Escape inside inner confirm fires only inner listener, returns focus to lightbox (T-37-03 mitigated, explicit test). jest-axe scan (color-contrast off) for all 5 + nested-trap + reduced-motion in src/tests/a11y/modals.test.tsx (22 tests). Full suite 671 pass, tsc clean.
- [Phase 37]: P01: useFocusTrap (D-01, zero deps) filters focusables via getComputedStyle (display/visibility/hidden/aria-hidden), NOT offsetParent — offsetParent is always null under jsdom and silently emptied the focusable set. Recomputes on each Tab keydown (Pitfall 2); isConnected guard on restore so a deleted trigger can't throw (Pitfall 4). <Modal> (D-02) portals to document.body, --bg-3 scrim via color-mix(in oklch,...), scrim-click + Escape both onClose, open transition gated on prefers-reduced-motion. jest-axe + @axe-core/playwright are devDeps ONLY (D-05, never shipped); no @types/jest-axe (jest-axe@10 bundles its own types). Plans 02/03 wire against useFocusTrap(panelRef,{onClose,initialFocusRef?}) + <Modal open onClose ariaLabelledBy?/ariaLabel? initialFocusRef?>.
- [Phase 36]: P02: import atomicity (D-01) is client-side compensating rollback — handleImport tracks createdSessionId + createdItemIds, on mid-loop throw deletes in reverse order best-effort then sticky notifyError; NO transactional RPC, NO schema change (SC2). A3/Q2 resolved: deleteSession/deleteItem are Supabase+zustand (FK cascade), not Dexie idMapping — no explicit Dexie cleanup needed. Export catch blocks + doCreate use fixed UI-SPEC copy; Login uses toUserMessage (T-36-02 — two old tests asserting raw 'Invalid login credentials' updated to 'Wrong email or password').

### Pending Todos

None.

### Blockers/Concerns

- ✅ **Phase 31 P0 CLOSED 2026-05-29:** profiles self-update escalation fixed on prod — `authenticated` UPDATE scoped to `walkthrough_completed` (theme conditional/absent on prod), `role`/`is_active` ungranted + `private.guard_profiles_privileged_columns` trigger; `anon` fully revoked. Admin audit clean (2 admins from v1.1 setup). Confirmatory app smoke (V-2/V-5) still recommended.
- **Discovered drift (follow-up, non-blocking):** (a) prod `profiles.theme` missing despite the theme migration being in history (app tolerates via localStorage fallback); (b) `database.types.ts` stale vs prod (missing `crm_*` tables).
- DEPLOY-04: Branch protection deferred (GitHub Free plan limitation on private repos) -- carried from v1.1
- Backlog item 999.1: Stream photos from Storage during extension import (large house visits balloon export JSON to 200-450MB) -- carried from v1.1
- Offline session display strategy still needs decision for future work -- carried from v1.1
- 18 pre-existing test failures (`localStorage.clear is not a function`) in `persist-scoping.test.ts` and `photo-migration.test.ts` -- discovered during Plan 22-01 verification; verified pre-existing at HEAD~3; tracked in `.planning/phases/22-foundation-tokens/deferred-items.md`

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260401-n74 | Fix AI parser interpreting karats as carrots - default to karats for auction house context | 2026-04-01 | dfa83c6 | | [260401-n74-fix-ai-parser-interpreting-karats-as-car](./quick/260401-n74-fix-ai-parser-interpreting-karats-as-car/) |
| 260401-n6a | AI parses spoken quote markers into actual quotation marks | 2026-04-01 | 5dbea9d | | [260401-n6a-ai-parses-spoken-quote-markers-into-actu](./quick/260401-n6a-ai-parses-spoken-quote-markers-into-actu/) |
| 260402-doe | Fix specialists unable to delete items - detect RLS silent failures in deleteItem/deleteSession | 2026-04-02 | c3710fa | | [260402-doe-specialists-unable-to-delete-items-from-](./quick/260402-doe-specialists-unable-to-delete-items-from-/) |
| 260402-dqf | Sale sessions same behavior as house sessions - full screen detail view with fields transcript and recording button, no photo upload | 2026-04-02 | 8a350ce | Needs Review | [260402-dqf-sale-sessions-same-behavior-as-house-ses](./quick/260402-dqf-sale-sessions-same-behavior-as-house-ses/) |
| 260402-dor | Ability to merge two items together into one | 2026-04-02 | a1a5816 | Verified | [260402-dor-ability-to-merge-two-items-together-into](./quick/260402-dor-ability-to-merge-two-items-together-into/) |
| 260407-ket | Add an extra export button that downloads a spreadsheet instead of the json | 2026-04-07 | de8f45a | | [260407-ket-add-an-extra-export-button-that-download](./quick/260407-ket-add-an-extra-export-button-that-download/) |
| 260407-ke7 | Jewelry karat vs carat differentiation in specialist | 2026-04-07 | bf56eda | | [260407-ke7-jewelry-karat-vs-carat-differentiation-i](./quick/260407-ke7-jewelry-karat-vs-carat-differentiation-i/) |

### Roadmap Evolution

- v1.0 MVP: Phases 1-9 + 5.1 (shipped 2026-03-17)
- v1.1 Accounts & Deploy: Phases 11-21 (shipped 2026-03-31)
- v1.2 UI Overhaul: Phases 22-30 (shipped 2026-05-13 via PR #11)
- v1.3 Maturation: Phases 31-40 queued 2026-05-29 (LIVE track; v3.0 hub cutover deferred per D-052) — none planned yet. Phase 40 = AI-proxy Cloudflare→Cloud Run migration (D-049).

## Session Continuity

Last session: 2026-06-02T15:50:40.179Z
Stopped at: Phase 38 UI-SPEC approved
Resume file: .planning/milestones/v1.3-phases/38-migration-retryability/38-UI-SPEC.md
