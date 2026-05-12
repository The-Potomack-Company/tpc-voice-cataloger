-- Backfill: artist_dates, artist_first_name, artist_last_name, artist_origin, medium
-- on public.items.
--
-- These columns already exist in the deployed Supabase project (confirmed via
-- npx supabase gen types --project-id wgrknodfxdjtddsirldw on 2026-05-11),
-- but were never captured in a workspace migration file. A4 (the schema drift
-- checker at ~/Projects/TPC/.claude/hooks/a4-schema-drift-checker.py) surfaced
-- the gap on 2026-05-11.
--
-- This file is a documentary back-fill — ADD COLUMN IF NOT EXISTS means it's a
-- no-op against the live DB and a true forward provisioning step against any
-- fresh project bootstrap. After applying via `supabase db push`, the
-- cumulative-migrations view A4 builds will match canonical _workspace/Schema/
-- schema.md and the items-related drift entry will clear.
--
-- See _workspace/Schema/schema.md → items (the "observed in deployed DB but
-- lacking a migration source" subsection) for the resolution context.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS artist_dates      text,
  ADD COLUMN IF NOT EXISTS artist_first_name text,
  ADD COLUMN IF NOT EXISTS artist_last_name  text,
  ADD COLUMN IF NOT EXISTS artist_origin     text,
  ADD COLUMN IF NOT EXISTS medium            text;
