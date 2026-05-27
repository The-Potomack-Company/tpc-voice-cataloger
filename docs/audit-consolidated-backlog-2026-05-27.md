# Consolidated Audit Backlog — 2026-05-27

Sources: Codex `ui-ux-resilience-audit-2026-05-27.md` (56 findings) + Claude verification/security/concurrency/perf/cost audit. Deduped, re-prioritized by prod risk. Status legend: [ ] open.

## P0 — Security (verify/fix immediately)

- [ ] **SEC-1 🔴 Privilege escalation via signup metadata.** `handle_new_user` (supabase/migrations/20260318000004_helper_functions.sql:46) sets `profiles.role` from `raw_user_meta_data->>'role'`. Anon key is public; `supabase.auth.signUp({options:{data:{role:'admin'}}})` → admin IF public signup is enabled. **ACTION: verify Supabase Auth "Allow new users to sign up" is OFF.** FIX: hardcode `'specialist'` in the trigger regardless of metadata.
- [ ] **SEC-2 🔴 Proxy key-abuse.** proxy/src/index.ts:11-14,32-66 — no auth on worker + `*.vercel.app` suffix CORS + non-browser clients bypass CORS entirely → anyone can burn the shared GEMINI_API_KEY. FIX: require Supabase JWT verify on worker; explicit origin allowlist.
- [ ] **SEC-3 🟠 Proxy accepts arbitrary `model`.** index.ts:48-53 client-supplied model interpolated into URL, payload unbounded → request expensive models on your key. FIX: allowlist model=gemini-2.5-flash; cap body size.
- [ ] **SEC-4 🟠 Storage bucket no ownership scope.** photos bucket INSERT/SELECT by any authenticated user (20260320200000_create_photos.sql:76-85) — any specialist can read/overwrite others' photo blobs by path. FIX: ownership-scoped storage policies.
- [ ] **SEC-5 🟠 Prompt injection.** gemini.ts:194 / geminiContinuous.ts:121 interpolate prior title/desc/transcript as "EXISTING VALUES" → instruction-like transcript steers next merge. Low blast radius. FIX: delimited data block, instruct model to treat as data.
- [ ] SEC-6 🟡 Edge functions use `Access-Control-Allow-Origin: '*'` (_shared/cors.ts:2); authz-gated by verifyAdmin so not directly exploitable. Pin origin.

## P1 — Data loss / corruption (verified)

- [ ] **DAT-1 🔴 Migration clears local tables on partial failure.** db/migration.ts:152-155 clears sessions/items/exportHistory unconditionally after skipped>0 → permanent loss of unmigrated records. FIX: only clear successfully-mapped rows; keep failures in a recovery table; mark migration partial.
- [ ] **DAT-2 🔴 AI failure overwrites `description`.** gemini.ts:331-335 writes status copy into description, clobbering prior content/manual edits. FIX: status in separate field/UI, never content.
- [ ] **DAT-3 🔴 Lost updates — no optimistic locking.** Read-modify-write merge (geminiContinuous.ts:240; sessionStore.ts:427) last-writer-wins; live edit vs chunk/retry overwrite each other. FIX: version/updated_at precondition or serialized writes.
- [ ] **DAT-4 🟠 updateItemField silent revert.** sessionStore.ts:417-453 reverts on non-network error with no user notice. FIX: surface toast + preserve draft.
- [ ] **DAT-5 🟠 Photo metadata dup.** photoUploadQueue.ts:88 plain insert (storage is upsert) → dup rows on retry; no unique constraint on storage_path. FIX: upsert/unique key.
- [ ] **DAT-6 🟠 photoMigration global complete flag set despite skipped photos.** photoMigration.ts:64,75 → skipped photos never retried. FIX: only flag when zero skipped.
- [ ] **DAT-7 🟠 Mixed-type db.audio.itemId index.** integer (legacy) vs UUID-string (cast) → equals() lookups can miss → good item marked failed / retry disabled. FIX: store itemId consistently as UUID string.
- [ ] DAT-8 🟠 receipt_number no unique constraint (20260318000002_create_items.sql) → collisions. FIX: partial unique index on (session_id, receipt_number).

## P2 — Reliability / concurrency / cost

- [ ] REL-1 🟠 Offline-queue retry storm: drain on every `online` event + re-queue, no backoff/attempt-cap (offlineQueue.ts; AppLayout.tsx:64-71). FIX: backoff + persisted attempt counter (also the net-abort #17 follow-up).
- [ ] REL-2 🟠 Concurrent drains/tabs: CONCURRENCY=4 + cross-tab no coordination → duplicate Gemini spend + lost update. FIX: atomic claim queued→processing.
- [ ] REL-3 🟠 Write-ahead queue blocks all later writes on first permanent failure, console-only (useWriteAheadQueue.ts). FIX: classify permanent vs transient; surface blocked count.
- [ ] REL-4 🟠 Audio save failure hangs stopRecording (useAudioRecorder.ts) — promise never settles on db.audio.add reject. FIX: settle with error, keep blob.

## P2 — Performance / memory (iOS)

- [ ] PERF-1 🟠 blobToBase64 (gemini.ts:92-102) holds 2-3 full copies of multi-MB audio → iOS tab OOM. FIX: chunked encode / out-of-band upload.
- [ ] PERF-2 🟠 Continuous master blob grows unbounded, re-materialized each 15s append (useContinuousRecorder.ts:62-83). FIX: stream-append / segment.
- [ ] PERF-3 🟠 ItemCard 2 live Dexie subscriptions × N items → re-render storm during recording (ItemCard.tsx:46-83). FIX: hoist session-level query, pass as props.

## P2 — UX correctness (from Codex audit, deduped)

- [ ] UX temperature=0 + confabulation guard + no-clobber-on-retry (TRACK 2, already planned).
- [ ] UX surface per-item retry on card (un-bury from expand) + item detail page (TRACK 2).
- [ ] UX: export failures invisible (#9,#10); new session/import not transactional (#7,#8); migration success copy false (#2); silent fetch errors (#27,#28); admin role/account load silent (#16-20); raw login errors (#21).
- [ ] A11y: modal focus-trap/aria primitive (#33,#34,#48); touch targets 44px (#46); icon-button tooltips (#49); swipe-delete alt affordance (#32).

## Continuous mode — disable recommendation (evidence)

4 stacked correctness hazards confirmed, single-mode has none of them:
- Look-back byte-splicing (useContinuousRecorder.ts:246; geminiContinuous.ts:84-103) → malformed/duplicated audio.
- liveItemId re-read inside queued task; epoch captured but never compared → wrong-item merges (geminiContinuous.ts:284-432).
- Wake-phrase replay: null-receipt dedup gap → spurious duplicate items (geminiContinuous.ts:347-394).
- No failed-chunk retry wiring → dropped chunks silently lost.
Plus: unbounded cost (~480 Gemini calls / 2h session, useContinuousRecorder.ts:26) + iOS OOM (PERF-2).
→ Recommendation: disable continuous entry point (forward commit / flag), keep code dormant. See ADR.

## Test gaps (Codex #51-56)
Migration recovery, write-ahead blocked state, audio save failure, photo dup metadata, authenticated E2E, error/offline visual states.
