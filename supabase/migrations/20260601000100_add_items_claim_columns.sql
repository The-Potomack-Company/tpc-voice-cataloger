-- REL-1/REL-2 (Phase 33: offline-reliability). Two additive columns on
-- public.items that the hardened offline drain depends on:
--   * claimed_at  — stamped by the DB-atomic queued→processing claim
--                   (update ... set ai_status='processing', claimed_at=now()
--                    where id=? and ai_status='queued' .select()); only the
--                    row-returning tab proceeds (D-01). Also the anchor for the
--                    exponential-backoff window claimed_at + base·2^ai_attempts
--                    (D-06) and the ~5min stale-claim reclaim (D-02).
--   * ai_attempts — server-side attempt counter (D-05), kept on the row (not
--                    Dexie-local) so counts stay consistent cross-tab/device.
--                    At the cap of 5 (D-07) the drain marks ai_status='failed',
--                    replacing the old client-side MAX_RETRIES=2 loop.
--
-- Cross-app schema event: cataloger + dashboard both read public.items
-- (canonical column list in ../_workspace/Schema/schema.md, updated first).
--
-- Security (T-33-01, Phase-31 lesson): DDL-only. NO `grant` here — the new
-- columns inherit the existing items RLS automatically. NO enum DDL — the
-- ai_status check already includes 'queued' and 'processing'
-- (20260318000002_create_items.sql:13-14). Additive `add column if not exists`
-- is safe on the live prod table: existing rows backfill to null / 0 with no
-- row migration (any pre-existing stuck `processing` row self-heals via D-02).

alter table public.items
  add column if not exists claimed_at timestamptz,
  add column if not exists ai_attempts integer not null default 0;
