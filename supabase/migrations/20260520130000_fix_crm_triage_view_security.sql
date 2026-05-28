-- Fix Codex adversarial-review findings on the CRM v0.5 schema (HIGH + MEDIUM).
-- Reviewer: Codex session 019e4624-b35c-7b00-8cdb-d535b66e4c8c, 2026-05-20.
--
-- Axis 4 (HIGH): crm_triage_queue view was created without
--   `with (security_invoker = true)`. By default views run with the
--   view-creator's privileges (typically a superuser via the migrations
--   role), which bypasses the underlying tables' admin-only RLS. Any future
--   non-admin grant on the view would expose subject, from_email,
--   from_name, snippet, and full body_text. Fix: recreate the view with
--   security_invoker=true so RLS evaluates against the caller's role.
--
-- Axis 7 (MEDIUM): the existing partial unique index on
--   crm_classifications (thread_id) where is_current = true supports
--   thread joins, but the consumer (frontend hook) sorts by priority +
--   classified_at on is_current rows. Add a composite partial index to
--   keep that query plan index-supported as the table grows.
--
-- Both fixes are additive per D-005 strangler constraint.

-- ─── Axis 4 fix ─────────────────────────────────────────────────────────────
create or replace view public.crm_triage_queue
  with (security_invoker = true) as
select
  t.id                  as thread_id,
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
  c.id                  as classification_id,
  c.department,
  c.priority,
  c.rationale,
  c.model,
  c.classified_at
from public.crm_threads t
left join public.crm_classifications c
  on c.thread_id = t.id
 and c.is_current = true;

comment on view public.crm_triage_queue is
  'CRM v0.5 demo (D-042): threads joined to their current classification. security_invoker=true so RLS evaluates against the caller (admins-only per crm_threads + crm_classifications policies).';

-- ─── Axis 7 fix ─────────────────────────────────────────────────────────────
create index if not exists crm_classifications_current_priority_idx
  on public.crm_classifications (priority, classified_at desc)
  where is_current = true;
