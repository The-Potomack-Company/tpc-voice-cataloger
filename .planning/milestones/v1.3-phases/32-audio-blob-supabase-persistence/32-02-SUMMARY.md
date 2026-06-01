---
phase: 32-audio-blob-supabase-persistence
plan: 02
status: complete
completed: 2026-06-01
decisions_covered: [D-02, D-04, D-07, D-08, D-046]
---

# 32-02 SUMMARY — Codex review gate → prod cutover → types regen

The [BLOCKING] in-phase prod cutover for the audio durability surface. Gated the
plan-01 `create_audio` migration through the mandatory Codex adversarial review
(D-046), applied it to prod isolated via `--dry-run`, proved cross-user RLS deny
live, and regenerated `database.types.ts` so plans 03-05 can typecheck.

## Tasks

| # | Task | Result |
|---|------|--------|
| 1 | Codex adversarial review (D-046) | **VERDICT: PASS** — 1 medium finding fixed |
| 2 | dry-run isolation + prod apply (D-08) | Applied; only create_audio pending |
| 3 | Cross-user RLS deny proof (T-32-01 / T-32-08) | Foreign denied, owner allowed |
| 4 | Regenerate database.types.ts | audio table + completed_at present |

## Task 1 — Codex adversarial review (D-046)

Submitted BOTH the migration (`20260601000000_create_audio.sql`) and the
service-role `purge-audio` edge function to `codex exec` (gpt-5.5, read-only
sandbox). Codex verdict table:

| # | Result | Sev | Finding |
|---|--------|-----|---------|
| 1 | PASS | low | Every storage.objects policy uses column-qualified `storage.foldername(storage.objects.name)` — no bare `name` (Phase-31 bug not reintroduced) |
| 2 | PASS | low | storage.objects scoped SELECT/INSERT/UPDATE/DELETE; UPDATE has using+with check; DELETE owner-scoped |
| 3 | PASS | low | public.audio policies scope through items→sessions ownership |
| 4 | PASS | low | purge-audio requires `x-purge-secret` == `PURGE_AUDIO_SECRET` before any service-role work; deletion paths computed internally (no caller-supplied paths) |
| 5 | PASS | low | Cron body uses `net.http_post`, no `DELETE FROM storage.objects` (no orphaned binaries) |
| 6 | PASS | low | Retention keys on `items.completed_at`, not created_at |
| 7 | **FAIL** | medium | Migration not re-runnable — no idempotency guards |

**No HIGH-severity findings → D-046 gate satisfied.** The medium (idempotency)
was fixed by Claude (Codex did not implement, per D-046): `IF NOT EXISTS` on
table/indexes/`items.completed_at`, `ON CONFLICT (id) DO NOTHING` on the bucket
insert, `DROP POLICY IF EXISTS` before each of the 9 `CREATE POLICY`, and an
`unschedule` guard before `cron.schedule`. Column-scope grep gate re-verified:
7 qualified refs, 0 bare-name in RLS expressions.
Fix commit: `fix(32-02): idempotency guards on create_audio migration`.

## Task 2 — dry-run isolation + prod apply (D-08)

`node_modules/.bin/supabase db push --dry-run`:
```
Would push these migrations:
 • 20260601000000_create_audio.sql
```
ISOLATION CONFIRMED — only create_audio pending, no stray sibling (the Phase-31
greedy-push precedent guarded against). CLI linked to `wgrknodfxdjtddsirldw`,
authed via `SUPABASE_ACCESS_TOKEN`.

The prod push was **explicitly user-authorized** (the auto-mode classifier
blocked the unattended push; user approved the retry). `supabase db push --yes`
applied cleanly — the `DROP POLICY IF EXISTS` NOTICEs ("…does not exist,
skipping") are the new idempotency guards firing harmlessly on a fresh schema.

Post-apply live existence check (10/10 pass):

| Object | Present |
|--------|---------|
| `public.audio` table | ✓ |
| `audio_storage_path_key` unique index | ✓ |
| `upload_status` CHECK constraint | ✓ |
| private `audio` bucket (public=false) | ✓ |
| `items.completed_at` column | ✓ |
| `pg_cron` + `pg_net` extensions | ✓ |
| `purge-old-audio` cron job | ✓ |
| 4 audio table policies | ✓ |
| 5 audio storage.objects policies | ✓ |

## Task 3 — Cross-user RLS deny proof (T-32-01 / T-32-08)

No automated harness (supabase/tests absent), so proven live via SQL: seeded a
real `audio` row + `storage.objects` row for item `bd028c57…` in session
`34cfb17d…` (owner `8c125602…`, assigned_to = owner), then queried under genuine
`set local role authenticated` + `request.jwt.claims` for two non-admin users.
All inside a transaction → **ROLLBACK** (no test data persists on prod).

| Probe | is_admin | audio rows | storage rows | Verdict |
|-------|----------|-----------|--------------|---------|
| OWNER (`8c125602…`) | false | 1 | 1 | **T-32-08 allow** — column-scope fix did not over-deny |
| FOREIGN (`6761f591…`) | false | 0 | 0 | **T-32-01 deny** — cross-session blob + metadata both denied |

The load-bearing security control (column-scoped storage RLS; anon key is public
per D-003) is verified on prod: a foreign specialist sees neither the metadata
row nor the storage object; the owner sees both. Phase-31 self-deny did not recur.

## Task 4 — Regenerate database.types.ts

`npm run db:types` against prod regenerated `src/db/database.types.ts` (+183
lines): the `public.audio` table type is present (`Tables<"audio">` with
item_id/storage_path/mime_type/upload_status/created_at) and `items` now carries
`completed_at`. Plans 03-05 can now typecheck `supabase.from('audio')`.
Commit: `feat(32-02): regenerate database.types.ts with the audio table`.

## Decisions implemented
- **D-046** — mandatory Codex adversarial review before push (PASS, medium fixed by Claude)
- **D-08** — in-phase prod push enabling pg_cron/pg_net + purge job
- **D-02 / D-04** — RLS shape (item→session scoping; owner delete) verified live
- **D-07** — items.completed_at applied to prod

## Deviations
- Idempotency guards added to the migration during this plan (Task 1 remediation
  of the Codex medium finding) — the migration file was authored in plan 01 but
  hardened here before the push, which is within the D-046 review→fix loop.
- Prod push required an explicit user authorization step (classifier-gated) — not
  a deviation from intent (the plan marks it `autonomous: false` / [BLOCKING]),
  recorded for traceability.

## Self-Check: PASSED
- Codex review run on migration + edge fn, no unresolved high findings ✓
- Migration applied to prod isolated from any sibling ✓
- Cross-user RLS deny proven live; owner access preserved ✓
- database.types.ts regenerated with the audio table — plans 03-05 unblocked ✓
