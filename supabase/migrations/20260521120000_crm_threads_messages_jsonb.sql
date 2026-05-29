-- CRM v0.5 Path B: per-message structured metadata.
--
-- Add `messages jsonb` to crm_threads holding the per-message array
-- extracted from Gmail's existing `threads.get` response. The display
-- consumes this directly, deleting the heuristic display-side text
-- parser at `tpc-dashboard/src/lib/crm-text/`.
--
-- Shape per element:
--   {
--     id: string,                        -- gmail message id
--     from: { name: string|null, email: string },
--     date: string,                      -- ISO 8601 from RFC 2822 Date header
--     subject: string,
--     body: string,                      -- plain text, HTML stripped
--     isForward: boolean,
--     hasAttachments: boolean
--   }
--
-- Read-only invariant unchanged: this column is populated from
-- additional fields of the existing `threads.get` API response. No new
-- Gmail API verbs, no write verbs (per [[feedback_crm_v05_readonly_invariant]]).
--
-- Additive only per D-005 strangler. `body_text` stays populated for
-- one milestone as a safety net for any hidden consumer; planned drop
-- in a follow-up migration once the structured path proves stable in
-- the demo + v3.5 production CRM.
--
-- Tables were TRUNCATEd 2026-05-21 — no backfill required.

-- ─── Add the column ────────────────────────────────────────────────────────
alter table public.crm_threads
  add column if not exists messages jsonb not null default '[]'::jsonb;

comment on column public.crm_threads.messages is
  'Per-message structured array from Gmail threads.get. Added 2026-05-21 (CRM v0.5 path B). Shape: {id, from:{name,email}, date, subject, body, isForward, hasAttachments}[]. Read-only — populated by api/crm-poll.ts via api/lib/crm/gmailApi.ts:extractMessages.';

-- ─── Recreate the view to expose the new column ────────────────────────────
-- Preserves every field from the prior view definition at
-- supabase/migrations/20260520160000_crm_triage_queue_add_needs_review.sql
-- in IDENTICAL ORDER, and APPENDS `messages` at the end. Postgres
-- `CREATE OR REPLACE VIEW` only allows additive column changes at the
-- tail — column reordering or insertion mid-list fails at deploy with
-- "cannot change name of view column ...". (Codex adversarial-review
-- HIGH finding, 2026-05-21.)
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
  t.messages                                                                       -- APPENDED 2026-05-21
from public.crm_threads t
left join public.crm_classifications c
  on c.thread_id = t.id
 and c.is_current = true;

comment on view public.crm_triage_queue is
  'CRM v0.5 demo (D-042): threads joined to their current classification; needs_review (since 20260520160000) and per-message structured messages (since 20260521120000) exposed for the transcript-style display.';
