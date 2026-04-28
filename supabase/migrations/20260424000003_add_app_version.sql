-- Add app_version column for cross-app versioning.
-- extension_version remains for the TPC extension's own concept; TPC_App leaves it NULL
-- and populates app_version (Vercel commit SHA in CI builds, package.json version locally).

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS app_version TEXT;

ALTER TABLE public.ui_interactions
  ADD COLUMN IF NOT EXISTS app_version TEXT;

CREATE INDEX IF NOT EXISTS analytics_events_app_version_idx
  ON public.analytics_events (app_source, app_version);
