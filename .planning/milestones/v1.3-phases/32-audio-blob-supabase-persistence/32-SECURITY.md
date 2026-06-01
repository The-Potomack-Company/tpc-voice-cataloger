---
phase: 32
slug: audio-blob-supabase-persistence
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-01
---

# Phase 32 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit verdict: **SECURED** — 16/16 threats closed (15 mitigate verified in code + 1 accept logged). block_on: high.

This phase adds a durable-audio surface: a private `audio` Storage bucket +
`public.audio` metadata table with session-owner-scoped RLS, a service-role
`purge-audio` retention/orphan reaper invoked by pg_cron, and the client
upload-queue / status / cross-device-fallback / hard-delete-cleanup plumbing.
The anon key is public (D-003) so storage + table RLS are the only boundaries
on blobs and metadata; the cron secret is the only boundary on the reaper.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| anon-key client → PostgREST → public.audio | Anon key is public (D-003); table RLS via item→session ownership is the only boundary on metadata rows. | audio metadata (storage_path, item_id) |
| anon-key client → Storage API → storage.objects (bucket 'audio') | Public anon key; column-scoped storage RLS on path token `[2]`=sessionId is the only boundary on blobs. | audio blobs (recordings) |
| pg_cron (server) → purge-audio edge function | Server-to-server; shared cron secret is the only boundary; function is service-role (bypasses RLS) so the secret gate is load-bearing. | delete authorization |
| purge-audio edge function → storage.objects | Service-role; computes its own path set — never trusts caller-supplied paths. | audio blob deletes |
| local CLI → prod migration history | `db push` is greedy — applies ALL pending; the --dry-run isolation gate prevents a stray sibling cutover. | schema/RLS migration |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-32-01 | Information Disclosure | cross-user audio blob read by path guess | mitigate | Column-scoped SELECT storage RLS — `supabase/migrations/20260601000000_create_audio.sql:117-128` (`(storage.foldername(storage.objects.name))[2]`=sessionId vs created_by/assigned_to) | closed |
| T-32-02 | Tampering | upload/overwrite into another session's path | mitigate | Scoped INSERT (with check) `…:130-141` + UPDATE (using+with check) `…:145-164` storage RLS | closed |
| T-32-03 | Tampering / DoS | delete another session's blob | mitigate | Scoped DELETE storage RLS — own sessions only — `…:167-178` (D-04) | closed |
| T-32-04 | Spoofing / Elevation | unauth/cross-user invokes purge-audio | mitigate | Secret gate `PURGE_AUDIO_SECRET` vs `x-purge-secret` `supabase/functions/purge-audio/index.ts:34-47`; self-computed path set `:56-124`; `createAdminClient` `:49` | closed |
| T-32-05 | DoS (self) | column-scope collision silently denies owner | mitigate | Column-qualified form baked in on all 5 storage policies; grep gate: 5 qualified, 0 bare `storage.foldername(name)` | closed |
| T-32-06 | Information Disclosure / cost | orphaned blobs leak audio after item delete | mitigate | `deleteItem` `storage.from("audio").remove()` `src/stores/sessionStore.ts:512-534` + pg_cron orphan backstop `purge-audio/index.ts:74-124` + delete RLS `create_audio.sql:167-178` | closed |
| T-32-07 | Tampering / data loss | stray sibling migration rides greedy db push | mitigate | `db push --dry-run` isolation gate documented `32-02-PLAN.md:412-441` + SUMMARY (process control, correctly out-of-code) | closed |
| T-32-08 | DoS (self) | column-scope collision over-denies owner | mitigate | Owner-read sanity check (Phase-31 self-deny mode) `32-02-PLAN.md:443-465`, live verdict in `32-02-SUMMARY.md` | closed |
| T-32-09 | Tampering | path uses legacy int itemId → wrong RLS scope | mitigate | `enqueueAudioUpload` typed `itemId: string`, used verbatim `src/services/audioUploadQueue.ts:21,32,84`; no `as unknown as number`; asserted by `audio-upload-queue.test.ts` | closed |
| T-32-10 | Information Disclosure | wrong content-type/ext breaks playback | mitigate | `extFromMime` `src/utils/audio.ts:31-43` + `contentType: entry.mimeType` `audioUploadQueue.ts:74`; no hardcoded `.opus` | closed |
| T-32-11 | DoS | unbounded retry storm | mitigate | `MAX_RETRIES=3` `audioUploadQueue.ts:8`, `Math.pow(4,n)*BACKOFF_BASE` `:125`, offline pause `:147` | closed |
| T-32-12 | Information Disclosure | fallback keyed by local int audioId | mitigate | Fallback `.eq("item_id", itemId)` UUID then download by storage_path `src/services/processAudioWithAi.ts:33-45`; never integer dexieAudioId; `audioLookup.ts:45-48` | closed |
| T-32-13 | Tampering | upload path reuses legacy-int coercion | mitigate | Recorder enqueues `itemId: itemIdRef.current` (UUID string) `src/hooks/useAudioRecorder.ts:208-213`; the `:192` coercion is Dexie legacy shape only, not the upload path | closed |
| T-32-14 | DoS | rejected enqueue aborts onstop / blocks AI | mitigate | Fire-and-forget `.then(drainAudioQueue).catch(()=>{})` `useAudioRecorder.ts:214-215`; AI trigger untouched | closed |
| T-32-15 | Tampering | specialist deletes another session's blob via deleteItem | mitigate | Column-scoped DELETE storage RLS `create_audio.sql:167-178`; deleteItem only operates on RLS-authorized items `sessionStore.ts:512-540` | closed |
| T-32-16 | DoS | storage.remove failure aborts item delete | mitigate | `remove()` in try/catch, logged + continues, item delete proceeds `sessionStore.ts:518-534`; asserted `sessionStore-audio-delete.test.ts:100-113` | closed |
| T-32-SC | Tampering | npm / CLI supply chain | accept | No new package installs this phase; first-party pg_cron/pg_net; pinned vendored CLI v2.81.3 (see Accepted Risks) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-32-01 | T-32-SC | No new package installs this phase; pg_cron/pg_net are first-party Supabase extensions; vendored Supabase CLI v2.81.3 pinned + unchanged. `git log -- package.json` last change `5a06fb8` (Phase 11), no install in Phase-32 range. Logged `32-04-SUMMARY.md:129`. | jushyi | 2026-06-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Live-verified controls (no automated RLS harness — recorded in SUMMARY)

- **T-32-01 / T-32-08** cross-user RLS deny + owner-read preservation: proven on prod with a disposable specialist token in plan 02 Task 3 (no `supabase/tests` harness exists; manual authorized prod reads). Evidence in `32-02-SUMMARY.md`. This is an inherent L1 gap, not a missing mitigation.
- **T-32-04** secret gate + self-computed path set additionally passed the mandatory Codex adversarial review (D-046) in plan 02 Task 1 before the function could be scheduled on prod.

---

## Code-review findings (non-threat)

`32-REVIEW.md` raised 2 Critical findings, both functional clone-parity bugs, neither tied to a threat-register ID:
1. `drainAudioQueue` not wired into app-mount / `online` reconnect — resolved; now wired at `src/layouts/AppLayout.tsx:8,63`.
2. `useAudioUploadStatus` reactive subscription broken — resolved in `85bed5d`.

Both resolved (`criticals_resolved: 2`); full suite green. No security regression; no bearing on any T-32 mitigation.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-01 | 17 | 17 | 0 | gsd-security-auditor (verify-mitigations mode) |

Verification commands run:
- Storage-RLS column-qualified grep gate: 5 qualified, 0 bare-`name` in policy bodies; 0 `DELETE FROM storage.objects` in non-comment SQL.
- `npx vitest --run` on audio-upload-queue / audio-storage-fallback / sessionStore-audio-delete / audio-lookup → 19/19 passed.
- `git log -- package.json` → no Phase-32 dependency change (T-32-SC).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-01
