-- CRM v0.5 demo UI polish (Track A): expose gmail_thread_id + add streak_stage_color.
--
-- Two changes:
--
-- 1. `crm_threads.streak_stage_color text` (nullable) — captures the stage
--    color Streak v1 /stages may return per stage (field name TBD on first
--    poll; the poller will write whichever color-ish field is present, or
--    NULL if Streak doesn't expose one). The UI uses this to tint a
--    full-width stage banner per row; falls back to a deterministic
--    hash-from-stage-name palette when NULL.
--
-- 2. Recreate `crm_triage_queue` view to APPEND `gmail_thread_id` and
--    `streak_stage_color` at the end. `gmail_thread_id` already lives on
--    `crm_threads` (since 20260520120000) but was never exposed via the
--    view; needed for the expanded-view "Open in Gmail" link. Same
--    additive-tail rule applies (CREATE OR REPLACE VIEW cannot reorder).
--
-- Additive only per D-005 strangler. Read-only invariant unchanged
-- (per [[feedback_crm_v05_readonly_invariant]]).

-- ─── 1. Add stage color column ─────────────────────────────────────────────
alter table public.crm_threads
  add column if not exists streak_stage_color text;

comment on column public.crm_threads.streak_stage_color is
  'Hex color string from Streak v1 /stages payload, when present. NULL when Streak does not expose a per-stage color or the field name diverges from what the poller extracts. UI falls back to a hash-from-stage-name palette. Added 2026-05-21 (CRM v0.5 demo UI polish).';

-- ─── 2. Recreate view to append new columns ────────────────────────────────
-- Preserves every field from the prior view definition at
-- supabase/migrations/20260521120000_crm_threads_messages_jsonb.sql in
-- IDENTICAL ORDER. APPENDS `gmail_thread_id` and `streak_stage_color` at
-- the end. Postgres CREATE OR REPLACE VIEW only allows additive column
-- changes at the tail — reordering fails at deploy with "cannot change
-- name of view column ...".
create or replace view public.crm_triage_queue
with (security_invoker = true) as
select
  t.id                                                       as thread_id,
  t.streak_box_key,
  t.streak_pipeline_key,
  t.streak_stage_key,
  t.streak_stage_name,
  t.subject,
  t.from_email,
  t.from_name,
  t.received_at,
  t.snippet,
  t.body_text,
  t.body_source,
  t.last_polled_at,
  c.id                                                       as classification_id,
  c.department,
  c.priority,
  c.rationale,
  c.model,
  c.classified_at,
  coalesce((c.metadata ->> 'needs_review')::boolean, false)  as needs_review,
  t.messages,                                                                      -- since 20260521120000
  t.gmail_thread_id,                                                               -- APPENDED 2026-05-21
  t.streak_stage_color                                                             -- APPENDED 2026-05-21
from public.crm_threads t
left join public.crm_classifications c
  on c.thread_id = t.id
 and c.is_current = true;

comment on view public.crm_triage_queue is
  'CRM v0.5 demo (D-042): threads joined to their current classification. Exposes needs_review (20260520160000), messages (20260521120000), gmail_thread_id + streak_stage_color (20260521210000) for the triage UI.';
