create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  role text not null default 'specialist' check (role in ('admin', 'specialist')),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (id)
);

alter table public.profiles enable row level security;
