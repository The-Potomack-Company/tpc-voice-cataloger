-- Phase 1 / INFR-05 — Provision analytics_events + admin SELECT RLS.
-- Mirrors TPC AI Cataloger extension migration 001 (applied to shared Supabase
-- project on 2026-04-21) so this file is a no-op on the live table and a
-- clean create against a fresh project. Extension-owned evolution (started_at,
-- ended_at, catalog_item rows) lands via future extension migrations using
-- `alter ... add column if not exists` — intentional forward-compat (D-21/D-22).
--
-- D-23: both RLS policies created atomically — admin SELECT (new) + anon INSERT
-- (mirrored from extension's live policy, idempotent via drop+create).

create table if not exists public.analytics_events (
  id                    uuid         primary key default gen_random_uuid(),
  event_type            text         not null,
  user_email            text,
  extension_version     text         not null,
  created_at            timestamptz  not null default now(),
  error_message         text,
  receipt_number        text,
  category_id           text,
  detection_method      text,
  photo_count           integer,
  generated_title       text,
  generated_description text,
  field_mode            text,
  field_selection       text,
  session_id            uuid,
  total_items           integer,
  success_count         integer,
  skipped_count         integer,
  error_count           integer,
  execution_time_ms     integer,
  cancelled             boolean,
  total_groups          integer,
  total_photos          integer,
  input_rows            integer,
  output_rows           integer,
  columns_mapped        integer,
  import_mode           text,
  items_content         jsonb
);

-- event_type vocabulary is owned by the TPC AI Cataloger extension (the writer); dashboard does not install a CHECK (D-22).

-- Enable RLS (idempotent).
alter table public.analytics_events enable row level security;

-- Anon INSERT — mirror extension's live policy exactly. Idempotent via drop+create.
-- If extension ever changes its policy, our file becomes incorrect; documented
-- coupling per D-22 (not a bug to engineer around).
drop policy if exists "analytics_insert_anon" on public.analytics_events;
create policy "analytics_insert_anon"
  on public.analytics_events
  for insert
  to anon
  with check (true);

-- Admin SELECT — NEW. Phase 1 INFR-05 target.
-- Policy name follows the `{table}_{op}_{role}` convention matching
-- `analytics_insert_anon`. Uses (select private.is_admin()) subquery wrapper
-- per TPC App pattern for statement-level caching.
-- CRITICAL: TO authenticated (not anon, not public) — RESEARCH Pitfall 2.
drop policy if exists "analytics_admin_select" on public.analytics_events;
create policy "analytics_admin_select"
  on public.analytics_events
  for select
  to authenticated
  using ( (select private.is_admin()) );

-- Explicit grants (D-23). Supabase applies default grants but we document
-- them here for forensics + to survive any future role-default rework.
grant insert on public.analytics_events to anon;
grant select on public.analytics_events to authenticated;

-- Composite index (idempotent).
create index if not exists analytics_events_event_type_created_at_idx
  on public.analytics_events (event_type, created_at desc);
