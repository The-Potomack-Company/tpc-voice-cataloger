-- Photos table: metadata for photos stored in Supabase Storage
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  storage_path text not null,
  thumbnail_path text not null,
  sort_order integer not null default 0,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create index idx_photos_item_id on public.photos (item_id);

-- Private storage bucket for photo blobs
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false);

-- ============================================================
-- PHOTOS TABLE RLS (session ownership, same as items)
-- ============================================================

-- Admins full access
create policy "Admins full access to photos"
  on public.photos for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists view photos in their sessions
create policy "Specialists view own photos"
  on public.photos for select
  to authenticated
  using (
    exists (
      select 1 from public.items i
      join public.sessions s on s.id = i.session_id
      where i.id = item_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists insert photos for their items
create policy "Specialists create own photos"
  on public.photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.items i
      join public.sessions s on s.id = i.session_id
      where i.id = item_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists delete own photos
create policy "Specialists delete own photos"
  on public.photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.items i
      join public.sessions s on s.id = i.session_id
      where i.id = item_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- ============================================================
-- STORAGE BUCKET RLS (on storage.objects)
-- ============================================================

-- Authenticated users can upload to photos bucket
create policy "Users can upload photos"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'photos' );

-- Authenticated users can read photos (for signed URLs)
create policy "Users can read photos"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'photos' );
