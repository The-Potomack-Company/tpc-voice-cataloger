-- D-042 follow-up: expose needs_review on the triage queue view so the
-- client can skip age-bumping rows that the classifier flagged as
-- unreadable (empty body, no thread, etc.). Source is
-- crm_classifications.metadata->'needs_review' (set by crmClassifier).

create or replace view public.crm_triage_queue
with (security_invoker=true) as
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
  c.id                                                       as classification_id,
  c.department,
  c.priority,
  c.rationale,
  c.model,
  c.classified_at,
  coalesce((c.metadata ->> 'needs_review')::boolean, false)  as needs_review
from public.crm_threads t
left join public.crm_classifications c
  on c.thread_id = t.id
 and c.is_current = true;

comment on view public.crm_triage_queue is
  'CRM v0.5 demo (D-042): threads joined to their current classification; needs_review exposed so client can suppress age-bump on unreadable rows.';
