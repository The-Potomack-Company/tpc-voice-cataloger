create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('house', 'sale')),
  status text not null default 'active'
    check (status in ('active', 'submitted', 'returned', 'exported')),
  notes text not null default '',
  review_notes text,
  created_by uuid not null references auth.users on delete cascade,
  assigned_to uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

-- Indexes for FK columns used in RLS policy WHERE clauses
create index idx_sessions_created_by on public.sessions (created_by);
create index idx_sessions_assigned_to on public.sessions (assigned_to);
