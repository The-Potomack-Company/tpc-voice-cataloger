create table if not exists public.item_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  batch_key text not null,
  segment_index integer not null,
  status text not null default 'draft'
    check (status in ('draft', 'promoted', 'discarded')),
  source_page_refs jsonb not null default '[]'::jsonb,
  raw_ocr_text text,
  title text,
  description text,
  condition text,
  estimate text,
  measurements text,
  category text,
  transcript text,
  receipt_number text,
  field_confidence jsonb not null default '{}'::jsonb,
  low_confidence_fields text[] not null default '{}'::text[],
  receipt_number_requires_review boolean not null default false,
  receipt_number_acknowledged boolean not null default false,
  promoted_item_id uuid references public.items on delete set null,
  created_by text not null default private.jwt_uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists item_drafts_batch_segment_key
  on public.item_drafts (session_id, batch_key, segment_index);
create index if not exists idx_item_drafts_session_status
  on public.item_drafts (session_id, status, created_at);

drop trigger if exists item_drafts_updated_at on public.item_drafts;
create trigger item_drafts_updated_at
  before update on public.item_drafts
  for each row execute function public.set_updated_at();

alter table public.item_drafts enable row level security;

drop policy if exists item_drafts_admin_all on public.item_drafts;
create policy item_drafts_admin_all
  on public.item_drafts for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists item_drafts_specialist_select on public.item_drafts;
create policy item_drafts_specialist_select
  on public.item_drafts for select to authenticated
  using (private.is_active_user() and private.owns_session(session_id));

drop policy if exists item_drafts_specialist_insert on public.item_drafts;
create policy item_drafts_specialist_insert
  on public.item_drafts for insert to authenticated
  with check (
    private.is_active_user()
    and private.owns_session(session_id)
    and created_by = private.jwt_uid()
  );

drop policy if exists item_drafts_specialist_update on public.item_drafts;
create policy item_drafts_specialist_update
  on public.item_drafts for update to authenticated
  using (private.is_active_user() and private.owns_session(session_id))
  with check (private.is_active_user() and private.owns_session(session_id));

grant select, insert, update on public.item_drafts to authenticated;
grant select, insert, update, delete on public.item_drafts to cataloger_api;
