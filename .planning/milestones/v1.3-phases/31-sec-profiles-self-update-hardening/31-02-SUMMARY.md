# Plan 31-02 Summary — Codex review → prod apply → verify

**Status:** Complete
**Self-Check: PASSED**

## What was done

Applied the Phase 31 migration to prod (`wgrknodfxdjtddsirldw`) after a mandatory Codex adversarial review, then verified the live security controls. Closes the P0 self-update privilege-escalation vector.

## Codex review (D-046)

Codex returned 1 MED finding ("table-form REVOKE does not clear column-level grants") — **disproven against ground truth**: a read-only `pg_attribute.attacl` check showed every `profiles` column has `attacl = null`, i.e. the drifted grant is **table-level** (Supabase default), not per-column. Table-form `REVOKE` clears it; Codex's suggested per-column REVOKE would be a no-op. The researcher's doc-cited claim was correct. All other Codex review axes (trigger predicate, admin-path exemption, idempotency, data-destruction, RPC/upsert paths) came back clean. No HIGH/blocking findings → gate passed.

## Deviation — drift-tolerant theme grant

First prod apply **failed + fully rolled back** (transactional): `column "theme" does not exist (42703)` at the `GRANT (walkthrough_completed, theme)` statement. Prod `profiles` has **no `theme` column** despite `20260512000000_add_theme_to_profiles.sql` being recorded in migration history — a benign, app-tolerated condition (theme migration uses `ADD COLUMN IF NOT EXISTS`; `themeStore.ts` handles `isMissingColumnError` with a localStorage fallback; `theme` is not in `database.types.ts`).

Fix (honors D-01/D-03 intent, drift-tolerant): `GRANT (walkthrough_completed)` unconditionally + a `DO` block that grants `theme` **only if the column exists**. Applies cleanly on prod now and auto-covers `theme` wherever the column lands. Re-applied successfully.

Post-rollback safety check confirmed the failed first apply left prod **unchanged** (authenticated/anon still had full UPDATE, no trigger, migration not recorded) — no partial/harmful state.

## Verification (V-1..V-7)

- **V-1 (grants) — PASS:** `authenticated` UPDATE columns = `walkthrough_completed` only (theme skipped — absent); `anon` UPDATE = none; `role`/`is_active` updatable by `authenticated` = **none**.
- **Guard trigger — PASS:** `trg_guard_profiles_privileged_columns` present; fn is `security invoker` + `search_path=""`.
- **V-2 (specialist role/is_active PATCH blocked) — PASS (control-layer proof):** `authenticated` holds no UPDATE privilege on role/is_active (Postgres denies the column write), plus the guard trigger as defense-in-depth. Live app PATCH smoke recommended as confirmatory.
- **V-5 (admin Edge path) — PASS (by construction):** `admin-update-user` runs as service_role (bypasses column grants) and the trigger exempts `current_user='service_role'`. Live app toggle smoke recommended as confirmatory.
- **V-6 (admin audit) — PASS:** 2 admins (both created 2026-03-18 during v1.1 setup), 9 specialists. No recently-created/unexpected admin — no self-promotion artifact. (User to confirm 2 is the expected admin count.)
- **V-7 (db:types zero diff from this migration) — PASS:** regen produced only unrelated `crm_*` table drift (not from this migration); reverted to keep the phase atomic.

## key-files
### created/modified
- `supabase/migrations/20260529000000_lock_profiles_self_update.sql` — applied to prod (recorded in `schema_migrations`).
- `supabase/queries/verify-profiles-grants.sql` — V-1 assertion query (from 31-01).

## Discovered drift (out of scope — flag for follow-up)
1. **Prod `profiles.theme` missing** despite the theme migration being in history — phantom/repaired migration. App tolerates it (localStorage fallback), so not a P0, but theme persistence is effectively off on prod until the column is actually added.
2. **`database.types.ts` stale vs prod** — prod has `crm_classifications`/`crm_threads` (CRM v0.5) not reflected in this repo's types. Separate cross-app type-sync cleanup.

## Remaining (confirmatory, non-blocking)
- Live app smoke: specialist self-escalate attempt (V-2) + admin activate/deactivate (V-5) from the prod/preview app.
- User confirm admin count (2) is expected.
