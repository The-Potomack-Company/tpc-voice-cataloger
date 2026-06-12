create table if not exists public.profiles (
  id text primary key,
  email text,
  role text not null default 'specialist' check (role in ('admin', 'specialist')),
  display_name text not null,
  is_active boolean not null default true,
  walkthrough_completed boolean not null default false,
  theme text check (theme is null or theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('house', 'sale')),
  status text not null default 'active'
    check (status in ('active', 'submitted', 'returned', 'exported', 'completed')),
  notes text not null default '',
  review_notes text,
  created_by text not null references public.profiles on delete cascade,
  assigned_to text references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
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
  artist_dates text,
  artist_first_name text,
  artist_last_name text,
  artist_origin text,
  medium text,
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'processing', 'done', 'failed', 'queued')),
  ai_attempts integer not null default 0,
  claimed_at timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  storage_path text not null,
  thumbnail_path text not null,
  sort_order integer not null default 0,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.audio (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  storage_path text not null,
  mime_type text not null,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.export_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  session_name text not null,
  session_mode text not null check (session_mode in ('house', 'sale')),
  item_count integer not null,
  exported_at timestamptz not null default now(),
  exported_by text not null references public.profiles on delete cascade
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.]{0,63}$'),
  user_email text,
  extension_version text,
  app_source text,
  app_version text,
  created_at timestamptz not null default now(),
  error_message text,
  receipt_number text,
  category_id text,
  detection_method text,
  photo_count integer,
  generated_title text,
  generated_description text,
  field_mode text,
  field_selection text,
  session_id uuid,
  total_items integer,
  success_count integer,
  skipped_count integer,
  error_count integer,
  execution_time_ms integer,
  cancelled boolean,
  total_groups integer,
  total_photos integer,
  input_rows integer,
  output_rows integer,
  columns_mapped integer,
  import_mode text,
  items_content jsonb,
  skipped_no_photos integer,
  skipped_fields_filled integer,
  skipped_manually integer,
  skipped_category_filter integer,
  skipped_classification_failed integer
);

create index if not exists idx_sessions_created_by on public.sessions (created_by);
create index if not exists idx_sessions_assigned_to on public.sessions (assigned_to);
create index if not exists idx_items_session_id on public.items (session_id);
create unique index if not exists items_receipt_unique
  on public.items (receipt_number)
  where receipt_number is not null and receipt_number <> '';
create index if not exists idx_photos_item_id on public.photos (item_id);
create unique index if not exists photos_storage_path_key on public.photos (storage_path);
create index if not exists idx_audio_item_id on public.audio (item_id);
create unique index if not exists audio_storage_path_key on public.audio (storage_path);
create index if not exists analytics_events_event_type_created_at_idx
  on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_app_source_idx
  on public.analytics_events (app_source);
create index if not exists analytics_events_app_version_idx
  on public.analytics_events (app_source, app_version);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_updated_at on public.sessions;
create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

drop trigger if exists items_updated_at on public.items;
create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.items enable row level security;
alter table public.photos enable row level security;
alter table public.audio enable row level security;
alter table public.export_history enable row level security;
alter table public.analytics_events enable row level security;
