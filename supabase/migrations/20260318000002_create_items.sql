create table public.items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  mode text not null check (mode in ('house', 'sale')),
  receipt_number text,
  title text,
  description text,
  condition text,
  estimate text,
  measurements text,
  category text,
  transcript text,
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'processing', 'done', 'failed', 'queued')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

-- Index for FK column used in RLS policy joins
create index idx_items_session_id on public.items (session_id);
