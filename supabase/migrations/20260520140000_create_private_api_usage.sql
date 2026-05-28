-- private.api_usage — audit log for all AI provider calls
--
-- Per D-015 (tpc-ai-proxy full per-request logging spec). Created early to
-- support CRM v0.5 demo classifier (D-042); v3.1 (tpc-ai-proxy Wrangler
-- proxy migration) inherits this table verbatim — no DDL changes expected.
--
-- Source apps initially writing here:
--   - tpc-dashboard-crm-poll (this milestone, CRM v0.5 demo)
--   - tpc-ai-proxy (post v3.1, Worker-side logging of every Gemini/Claude/
--     OpenAI request)
--
-- Schema lives under `private.` schema (not public) to keep it out of the
-- PostgREST default surface. Service-role inserts only. Admins SELECT via
-- explicit policy.
--
-- Additive per D-005 strangler.

create schema if not exists private;

create table if not exists private.api_usage (
  id            uuid primary key default gen_random_uuid(),
  ts            timestamptz not null default now(),
  user_id       uuid references auth.users on delete set null,
  model         text not null,
  provider      text not null check (provider in ('gemini','anthropic','openai','other')),
  tokens_in     integer,
  tokens_out    integer,
  cost_usd      numeric(10, 6),
  app_source    text not null,
  request_id    uuid,
  duration_ms   integer,
  status        text not null default 'ok' check (status in ('ok','error','rate_limited')),
  error_message text,
  metadata      jsonb not null default '{}'::jsonb
);

create index if not exists api_usage_ts_idx
  on private.api_usage (ts desc);

create index if not exists api_usage_app_source_ts_idx
  on private.api_usage (app_source, ts desc);

create index if not exists api_usage_user_id_idx
  on private.api_usage (user_id)
  where user_id is not null;

alter table private.api_usage enable row level security;

-- Admins SELECT — observability surface, server-side aggregations.
-- No client INSERT/UPDATE policies; service-role writes only.
create policy "api_usage admins read"
  on private.api_usage for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
        and is_active = true
    )
  );

comment on table private.api_usage is
  'D-015 audit log of AI-provider calls. Service-role inserts only. Admins SELECT for cost rollups + prompt-iteration analysis. CRM v0.5 demo (D-042) is the first writer; tpc-ai-proxy v3.1 inherits.';
