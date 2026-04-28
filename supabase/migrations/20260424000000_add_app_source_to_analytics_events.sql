-- Coordinated cross-app change to the shared analytics_events table.
-- TPC_App owns this migration. The TPC browser extension is being updated in parallel
-- to populate app_source = 'tpc-extension'; existing rows remain NULL and are backfilled lazily (or not at all).
--
-- Changes:
--   1. Add nullable app_source column so multiple TPC apps can share the table.
--   2. Relax extension_version NOT NULL (TPC_App and future apps may not have that concept).
--   3. Replace any existing IN-list CHECK on event_type with a shape-only regex guard.
--      Rationale: an IN-list forces a coordinated migration every time either app adds an event.
--      The regex caps length and enforces lowercase + dot/underscore — typo-catching is already
--      done by the event_type constants in each app's code.
--   4. Index app_source and (event_type, created_at DESC) for dashboard queries.

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS app_source TEXT;

ALTER TABLE public.analytics_events
  ALTER COLUMN extension_version DROP NOT NULL;

-- Drop any existing CHECK constraints on event_type (name unknown across envs).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'analytics_events'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.analytics_events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_event_type_shape_chk
  CHECK (event_type ~ '^[a-z][a-z0-9_.]{0,63}$');

CREATE INDEX IF NOT EXISTS analytics_events_app_source_idx
  ON public.analytics_events (app_source);

CREATE INDEX IF NOT EXISTS analytics_events_event_type_created_at_idx
  ON public.analytics_events (event_type, created_at DESC);
