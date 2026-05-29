-- CRM v0.5 demo schema (per D-042 + D-029 incremental ship)
--
-- One-time D-037 override per D-042: lives on tpc-dashboard for an internal
-- demo this week, then v3.5 production CRM ships into the hub post-cutover
-- against the SAME schema (additive per D-005 strangler — no DROP, no RENAME).
--
-- Two tables:
--   crm_threads          — one row per Streak box / Gmail thread observed.
--   crm_classifications  — LLM classifier output; latest-per-thread is_current.
--
-- Sources of truth:
--   - Streak (the consign@ CRM-of-record today) — read via REST API. Stage
--     filter: only boxes NOT in closed/post-qualifying stages.
--   - Gmail (OAuth gmail.readonly fallback) — only invoked if Streak's
--     returned snippet is too short for the classifier to handle.
--
-- RLS: admins-only SELECT. Writes are server-side only (Vercel Function
-- with service-role key); no client INSERT/UPDATE policy by design.
--
-- D-038 dev-filter: not applied here. Threads are external-consignor data,
-- not internal-TPC user data — there's no user_id dimension to filter on.

-- ─── crm_threads ────────────────────────────────────────────────────────────
create table if not exists public.crm_threads (
  id                    uuid primary key default gen_random_uuid(),
  streak_box_key        text unique not null,
  streak_pipeline_key   text not null,
  streak_stage_key      text,
  streak_stage_name     text,
  gmail_thread_id       text,
  subject               text,
  from_email            text,
  from_name             text,
  received_at           timestamptz,
  snippet               text,
  body_text             text,
  body_source           text not null default 'streak'
                        check (body_source in ('streak','gmail')),
  last_polled_at        timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists crm_threads_streak_box_key_idx
  on public.crm_threads (streak_box_key);

create index if not exists crm_threads_received_at_idx
  on public.crm_threads (received_at desc);

create trigger crm_threads_updated_at
  before update on public.crm_threads
  for each row execute function public.set_updated_at();

alter table public.crm_threads enable row level security;

create policy "crm_threads admins read"
  on public.crm_threads for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );

-- ─── crm_classifications ────────────────────────────────────────────────────
create table if not exists public.crm_classifications (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.crm_threads(id) on delete cascade,
  department      text[] not null
                  check (
                    array_length(department, 1) >= 1
                    and department <@ array['furniture','decarts','books','fashion','art_sculpture']::text[]
                  ),
  priority        text not null check (priority in ('high','standard','low')),
  rationale       text not null,
  model           text not null,
  prompt_version  text not null default 'v0.5.0',
  is_current      boolean not null default true,
  classified_at   timestamptz not null default now()
);

create unique index if not exists crm_classifications_current_per_thread_idx
  on public.crm_classifications (thread_id)
  where is_current = true;

create index if not exists crm_classifications_thread_idx
  on public.crm_classifications (thread_id);

create index if not exists crm_classifications_priority_idx
  on public.crm_classifications (priority);

alter table public.crm_classifications enable row level security;

create policy "crm_classifications admins read"
  on public.crm_classifications for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );

-- ─── Convenience view ───────────────────────────────────────────────────────
-- Triage queue join: threads + their current classification, priority-sorted.
-- The frontend reads from here for the landing-page inbox.
create or replace view public.crm_triage_queue as
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
  'CRM v0.5 demo (D-042): threads joined to their current classification, priority-sorted by the consumer.';
