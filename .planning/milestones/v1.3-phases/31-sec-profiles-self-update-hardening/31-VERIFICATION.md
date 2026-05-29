---
phase: 31
slug: sec-profiles-self-update-hardening
status: passed
verified_at: 2026-05-29
method: direct-prod-verification + cross-vendor-review
---

# Phase 31 — Verification (goal-backward)

**Phase goal:** Close the live-on-prod P0 — an authenticated specialist self-promoting to admin via `PATCH /rest/v1/profiles {role:'admin', is_active:true}`.

**Verdict: PASSED.** The vector is closed on prod (`wgrknodfxdjtddsirldw`), verified against the live database (more authoritative than a file-reading verifier pass, which is why the gsd-verifier subagent was not spawned).

## Goal-backward evidence (queried live on prod)

| Truth (from PLAN must_haves) | Evidence | Result |
|---|---|---|
| A non-admin authenticated session can never change role/is_active | `information_schema.column_privileges`: `authenticated` UPDATE on role/is_active = **none**; `private.guard_profiles_privileged_columns` BEFORE UPDATE trigger present (security invoker, search_path="") as second layer | ✅ |
| `authenticated` holds UPDATE only on self-editable columns | `authenticated` UPDATE cols = `walkthrough_completed` (theme conditional — absent on prod) | ✅ |
| `anon` holds no UPDATE | `anon` UPDATE cols = **none** | ✅ |
| Migration is idempotent / re-runnable | second apply succeeded after a clean transactional rollback of the first (theme-drift) attempt; `DROP TRIGGER IF EXISTS` + `CREATE OR REPLACE FUNCTION` | ✅ |
| Legitimate admin Edge path still works | trigger exempts `current_user='service_role'`; `admin-update-user` runs as service_role (also bypasses column grants) | ✅ by construction |
| No prior self-promotion (audit) | V-6: 2 admins, both created 2026-03-18 (v1.1 setup); 9 specialists; no unexpected admin | ✅ |
| Migration is type-neutral | V-7: db:types regen showed only unrelated `crm_*` drift; zero profiles/grant/trigger type change | ✅ |

## Cross-vendor review (D-046 / D-044)
Codex adversarial review: 1 MED finding ("table REVOKE leaves column grants") **disproven** via `pg_attribute.attacl` (all null → grant is table-level, cleared by table-form REVOKE). All other axes clean. No HIGH/blocking.

## Deviation
`theme` grant made conditional on column existence — prod `profiles` lacks `theme` (benign, app-tolerated drift). Honors D-01/D-03 intent; drift-tolerant. See 31-02-SUMMARY.md.

## Confirmatory (non-blocking, recommended)
- Live app smoke V-2 (specialist self-escalate attempt → rejected) and V-5 (admin activate/deactivate → works) from the prod/preview app — the control-layer proof above already establishes both, these are end-to-end confirmation.
- User confirm 2 admins is the expected count.

## Follow-ups discovered (out of scope — separate work)
1. Prod `profiles.theme` missing despite migration history (phantom). App degrades gracefully; theme persistence off on prod until the column is added.
2. `database.types.ts` stale vs prod (`crm_classifications`/`crm_threads` not synced) — cross-app type cleanup.
