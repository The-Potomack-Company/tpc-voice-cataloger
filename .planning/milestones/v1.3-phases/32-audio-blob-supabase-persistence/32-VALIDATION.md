---
phase: 32
slug: audio-blob-supabase-persistence
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
revised: 2026-06-01
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (unit, jsdom) + Playwright ^1.60.0 (e2e) |
| **Config file** | vite.config.ts (test block, setup `src/tests/setup.ts`) |
| **Quick run command** | `npx vitest --run <touched test file>` |
| **Full suite command** | `npm test` (vitest --run) |
| **Estimated runtime** | ~20-40s full unit suite; single-file ~2-5s |

---

## Sampling Rate

- **After every task commit:** Run the touched test file (`npx vitest --run <file>`) or `npx tsc --noEmit` for wiring-only tasks.
- **After every plan wave:** Run `npm test` (full unit suite).
- **Before `/gsd:verify-work`:** Full suite green + the four manual security/cross-device checks (below) executed + mandatory Codex review of the migration (D-046) recorded.
- **Max feedback latency:** ~40s (full suite).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | D-01,D-02,D-03,D-04,D-07,D-08 | T-32-01,02,03,05 | Every storage.objects specialist policy uses column-qualified `storage.foldername(storage.objects.name)` (Phase-31 self-deny fix baked in); 5 storage policies; upload_status CHECK; pg_cron body uses pg_net.http_post not raw DELETE | grep gate (policy-form assertion) | `grep -v '^--' supabase/migrations/20260601000000_create_audio.sql \| grep -c 'storage.foldername(storage.objects.name)'` | ✅ (created by task) | ✅ green |
| 01-T2 | 01 | 1 | D-03,D-04,D-08 | T-32-04,06 | purge-audio gates on shared secret (PURGE_AUDIO_SECRET), computes its own path set (no caller-supplied paths), deletes via storage.remove() not raw storage.objects DELETE | grep gate (secret + remove + admin client) | `grep -c "createAdminClient\|storage.from('audio').remove\|PURGE_AUDIO_SECRET" supabase/functions/purge-audio/index.ts` | ✅ (created by task) | ✅ green |
| 01-T3 | 01 | 1 (Wave-0) | — | — | RED scaffolds encode the upload/status/fallback/pill/delete contracts (path/ext mime-derived, UUID itemId, storage.remove on delete) before any production code exists | scaffold existence (RED) | `ls src/tests/audio-upload-queue.test.ts src/tests/audio-upload-status.test.ts src/tests/audio-storage-fallback.test.ts src/tests/item-card-audio-status.test.tsx src/tests/sessionStore-audio-delete.test.ts` | ✅ (created by task) | ✅ green |
| 02-T1 | 02 | 2 | D-046 | T-32-04 | Codex adversarial review of migration + purge-audio edge fn; no unresolved high-severity findings before any prod push | MANUAL (D-046 human-gated; verdict in SUMMARY) | MISSING — Codex review is a human gate; column-scope grep gate already covered by 01-T1 | n/a | ✅ manual |
| 02-T2 | 02 | 2 | D-08 | T-32-07 | `db push --dry-run` isolation — ONLY create_audio pending (greedy-push guard); applied to prod + recorded in migration history | MANUAL (dry-run isolation + CLI apply confirmation + authorized prod existence reads) | MISSING — prod apply verified via dry-run output + CLI confirmation + SQL/MCP existence reads (manual) | n/a | ✅ manual |
| 02-T3 | 02 | 2 | D-02 | T-32-01,T-32-08 | Cross-user storage + table read by user B under user A's session → denied/empty; AND owner (user A) CAN read own audio (Phase-31 self-deny did not recur) | MANUAL/SQL (disposable specialist token; no automated harness — supabase/tests absent) | MISSING — authorized prod reads with disposable user-B + user-A tokens; results recorded in SUMMARY | n/a | ✅ manual |
| 02-T4 | 02 | 2 | D-08 | — | Regenerated types include the live `audio` table + `items.completed_at` (proves the push landed) | automated (regen + grep) | `npm run db:types && grep -c '"audio"\|audio:' src/db/database.types.ts` | ✅ src/db/database.types.ts | ✅ green |
| 03-T1 | 03 | 3 | — | — | Dexie v10 additive upgrade; v9 data survives; audioUploadQueue table queryable | automated (vitest, enqueue subset) | `npx vitest --run src/tests/audio-upload-queue.test.ts -t "enqueue"` | ✅ (plan-01 scaffold) | ✅ green |
| 03-T2 | 03 | 3 | D-05 | T-32-13 | Path uses mime-derived ext (never `.opus`), itemId is the UUID string (never the int coercion); idempotent metadata upsert (onConflict storage_path); concurrency 2 / 4^n backoff / max 3 | automated (vitest) | `npx vitest --run src/tests/audio-upload-queue.test.ts` | ✅ (plan-01 scaffold) | ✅ green |
| 03-T3 | 03 | 3 | D-06 | — | useAudioUploadStatus reactively returns pending/uploading/uploaded/failed/none | automated (vitest) | `npx vitest --run src/tests/audio-upload-status.test.ts` | ✅ (plan-01 scaffold) | ✅ green |
| 04-T1 | 04 | 4 | D-02,D-05 | T-32-13,14 | sessionId threaded onto the row; fire-and-forget enqueue with UUID itemId + mime ext; rejected enqueue does not block AI/onstop | automated (tsc; behavioral enqueue contract covered by audio-upload-queue.test.ts) | `npx tsc --noEmit 2>&1 \| tail -5` | n/a (no recorder test file; queue test covers the enqueue contract) | ✅ green |
| 04-T2 | 04 | 4 | D-05,D-07 | T-32-12 | Storage download fallback keyed by item_id (UUID) not the int audioId; throws clearly when both sources miss; completed_at stamped on AI-done (retention clock) | automated (vitest) | `npx vitest --run src/tests/audio-storage-fallback.test.ts` | ✅ (plan-01 scaffold) | ✅ green |
| 04-T3 | 04 | 4 | D-02 | — | audioRecordsForItem unions Supabase audio (cross-device visible by count); rule (a) Dexie-authoritative for latestAudioId; no double-count | automated (vitest) | `npx vitest --run src/tests/audio-lookup.test.ts` | ✅ extend (existing) | ✅ green |
| 05-T1 | 05 | 4 | D-04 | T-32-06,15,16 | deleteItem removes audio binaries via storage.from('audio').remove(paths) resolved by item_id; rows?.length guard; remove() failure non-fatal (pg_cron backstop); no raw storage.objects DELETE | automated (vitest — the plan-01 RED scaffold) | `npx vitest --run src/tests/sessionStore-audio-delete.test.ts` | ✅ (plan-01 scaffold) | ✅ green |
| 05-T2 | 05 | 4 | D-06 | — | ItemCard pill reflects upload status (uploaded/pending/uploading/failed/none) via Badge; failed→retry calls retryFailedUploads | automated (vitest) | `npx vitest --run src/tests/item-card-audio-status.test.tsx` | ✅ (plan-01 scaffold) | ✅ green |

*Status: ✅ green · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** No 3 consecutive code-producing tasks lack an automated verify. The only `MISSING` verifies are 02-T1/T2/T3 — all three are inherently manual security/prod-cutover gates (Codex review, greedy-push isolation, cross-user RLS proof with disposable tokens; no automated harness exists — `supabase/tests/` absent). They are bracketed by automated tasks (01-T1/T2/T3 before, 02-T4 after).

---

## Wave 0 Requirements

Plan 01 Task 3 lays down these RED scaffolds (clone the `vi.hoisted` mock harness from `src/tests/photo-upload-queue.test.ts:1-75`). They reference production modules built in plans 03-05, so they MUST fail/not-resolve at plan-01 commit (intended RED):

- [x] `src/tests/audio-upload-queue.test.ts` — enqueue path/ext(mime-derived, not `.opus`)/UUID-itemId; drain concurrency 2; 4^n backoff; max 3; idempotent metadata upsert (onConflict storage_path). Made green by 03-T1/T2.
- [x] `src/tests/audio-upload-status.test.ts` — useAudioUploadStatus pending/uploading/uploaded/failed/none reactive. Made green by 03-T3.
- [x] `src/tests/audio-storage-fallback.test.ts` — processAudioWithAi downloads from Storage (keyed by item_id UUID) when the Dexie blob is missing. Made green by 04-T2.
- [x] `src/tests/item-card-audio-status.test.tsx` — pill renders + failed→retry re-enqueues. Made green by 05-T2.
- [x] `src/tests/sessionStore-audio-delete.test.ts` — deleteItem selects audio storage_paths by item_id, calls `storage.from('audio').remove([...])` with those paths, rows?.length guard, remove()-failure-non-fatal (D-04 automated assertion — W-2 fix). Made green by 05-T1.
- [x] Extend `src/tests/audio-lookup.test.ts` (existing) for the Supabase-audio union (rule (a)). Extended green by 04-T3.

---

## Manual-Only Verifications

| Behavior | Decision / Threat | Why Manual | Test Instructions |
|----------|-------------------|------------|-------------------|
| Codex adversarial review of migration + purge-audio edge fn | D-046 / T-32-04 | Human-gated review control (Codex reviews, does not implement); not a code assertion | Submit migration + edge fn to Codex with the T-32 STRIDE focus (column-scope, 4 CRUD verbs scoped, secret gate, pg_net not raw DELETE, retention on completed_at). No unresolved high findings. Verdict in SUMMARY. (02-T1) |
| `db push --dry-run` isolation + prod apply | D-08 / T-32-07 | `db push` is greedy + may need user-only CLI auth; prod mutation | `node_modules/.bin/supabase db push --dry-run` → ONLY create_audio pending (STOP if any sibling). Apply with `--yes`. Confirm audio table + bucket + items.completed_at + pg_cron/pg_net + purge-old-audio job via SQL/MCP reads. (02-T2) |
| Cross-user RLS deny (foreign-session blob/table read) | D-02 / T-32-01 | Requires a disposable specialist token for a second user; no automated harness (`supabase/tests/` absent); anon key public so RLS is the only boundary | As user B (not owner, not admin): read/list `audio/{A-sessionId}/...` → denied/empty; `select * from public.audio` for user A's item → 0 rows. Record in SUMMARY. (02-T3) |
| Owner-read sanity check (self-deny did NOT recur) | D-02 / T-32-08 | Same disposable-token setup; proves the column-scope fix did not over-deny (the Phase-31 self-deny failure mode) | As user A (owner): read/list own `audio/{A-sessionId}/...` → ALLOWED. Record in SUMMARY. (02-T3) |
| Cross-device retry (device A records, device B retries from Storage) | D-05 | End-to-end across two browser contexts/devices; not a unit boundary | Playwright two-context or manual UAT: record on A, clear B's Dexie, trigger AI retry on B → processAudioWithAi pulls the blob from Storage by item_id. (covered structurally by 04-T2 unit; full e2e is manual) |
| Blob purged on hard-delete (binary gone, not just metadata) | D-04 | Requires inspecting live storage.objects after a real delete | Delete an item with audio → assert both the `public.audio` metadata row (FK cascade) AND the storage.objects binary are gone. Unit `storage.remove` call covered by 05-T1; binary-gone confirmation is manual. |
| pg_cron purge after 30d-done | D-03 / D-08 | Cron timing + service-secret invocation; not a client unit | Backdate an item's `completed_at` > 30 days with `ai_status='done'`, invoke the purge-audio cron body / edge fn manually, assert the blob + metadata are reaped. |

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or are documented Wave-0 / manual-only with rationale
- [x] Sampling continuity: no 3 consecutive code-producing tasks without automated verify (the 3 MISSING are inherent manual security/cutover gates, bracketed by automated tasks)
- [x] Wave 0 covers all MISSING test references (5 scaffolds + 1 extension)
- [x] No watch-mode flags (`--run` everywhere)
- [x] Feedback latency < 40s (full suite)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** ready — pre-execution authoring complete (revision pass 2026-06-01).

---

## Validation Audit 2026-06-01

Post-execution audit. Every automated verify re-run live; every manual gate cross-checked against `32-02-SUMMARY.md`.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Automated re-run results:**
- 6 vitest files green — 29/29 tests pass (`audio-upload-queue`, `audio-upload-status`, `audio-storage-fallback`, `item-card-audio-status`, `sessionStore-audio-delete`, `audio-lookup`).
- 01-T1 grep gate: 5 column-scoped storage policies (expected 5). ✅
- 01-T2 grep gate: 6 secret/admin/remove refs in `purge-audio` (expected ≥1). ✅
- 02-T4 grep gate: `audio` present in `database.types.ts` (expected ≥1). ✅
- 04-T1 `tsc --noEmit`: clean (exit 0). ✅

**Manual gates (evidenced in `32-02-SUMMARY.md`):**
- 02-T1 Codex adversarial review (D-046): VERDICT PASS, 1 medium fixed by Claude.
- 02-T2 dry-run isolation + prod apply (D-08): only `create_audio` pending; applied clean.
- 02-T3 cross-user RLS: live SQL proof (rolled-back tx) — OWNER allowed (1/1 rows), FOREIGN denied (0/0). Phase-31 self-deny did not recur.

**Verdict:** Phase 32 is Nyquist-compliant. No new test files generated.
