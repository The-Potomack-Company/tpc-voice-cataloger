create table public.export_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  session_name text not null,
  session_mode text not null check (session_mode in ('house', 'sale')),
  item_count integer not null,
  exported_at timestamptz not null default now(),
  exported_by uuid not null references auth.users on delete cascade
);

alter table public.export_history enable row level security;
