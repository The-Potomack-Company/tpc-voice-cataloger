-- Mirror of cataloger's migration 007_add_batch_skip_reason_breakdown.sql
-- Date-stamped for deployment via this repo's working `supabase db push` path.
-- Ownership: D-22 says analytics_events is extension-owned; the canonical
-- file lives at `tpc-extension/supabase/migrations/007_*.sql`. This file is
-- a deployment artifact only — it exists because the cataloger's migration
-- history is locally-tracked-only and does not share its history with the
-- supabase CLI tracking that the dashboard uses.
-- Feature spec: `_workspace/Features/category-filtered-batch.md`.

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS skipped_no_photos              integer,
  ADD COLUMN IF NOT EXISTS skipped_fields_filled          integer,
  ADD COLUMN IF NOT EXISTS skipped_manually               integer,
  ADD COLUMN IF NOT EXISTS skipped_category_filter        integer,
  ADD COLUMN IF NOT EXISTS skipped_classification_failed  integer;

COMMENT ON COLUMN public.analytics_events.skipped_no_photos              IS 'Batch: items skipped because they had no photos';
COMMENT ON COLUMN public.analytics_events.skipped_fields_filled          IS 'Batch: items skipped because target fields already filled (skip-mode)';
COMMENT ON COLUMN public.analytics_events.skipped_manually               IS 'Batch: items skipped because user clicked Skip';
COMMENT ON COLUMN public.analytics_events.skipped_category_filter        IS 'Batch: items skipped because category not in active filter (added 2026-05-13)';
COMMENT ON COLUMN public.analytics_events.skipped_classification_failed  IS 'Batch: items skipped because AI category detection failed under active filter (added 2026-05-13)';

NOTIFY pgrst, 'reload schema';
