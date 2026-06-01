-- Phase 32: durable audio persistence in Supabase Storage.
--
-- Mirrors the photos surface (20260320200000_create_photos.sql) for audio blobs:
--   * public.audio metadata table (no thumbnail/sort_order; adds mime_type)
--   * private 'audio' Storage bucket
--   * session-owner-scoped table RLS (item -> session ownership)
--   * session-owner-scoped storage.objects RLS, using the COLUMN-QUALIFIED
--     storage.foldername(storage.objects.name) form from line one — the Phase 31
--     photo bug (20260527000001 used a bare `name` that bound to s.name and denied
--     the owner; 20260528000002 fixed it). We bake the fix in here so the audio
--     bucket never ships the buggy form.
--
-- Path convention (audioUploadQueue, plans 03-05):
--   audio/{sessionId}/{itemId}/{audioId}.{ext}
--   => storage.foldername(name) = {audio, sessionId, itemId}; sessionId = [2].
--
-- Plus the D-07 retention baseline (items.completed_at) and the D-08 retention
-- sweep (pg_cron + pg_net -> purge-audio edge function).
--
-- NOTE: authored here (Phase 32 plan 01); applied to prod only in plan 02 after a
-- mandatory Codex adversarial review (D-046). Do NOT push from this plan.

-- ============================================================
-- AUDIO METADATA TABLE
-- ============================================================
create table if not exists public.audio (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  storage_path text not null,
  mime_type text not null,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.audio enable row level security;

-- DAT-5 idempotency: a retried metadata upsert can't create a duplicate row
-- (mirrors photos_storage_path_key). Enables ON CONFLICT (storage_path) DO NOTHING.
create unique index if not exists audio_storage_path_key on public.audio (storage_path);
create index if not exists idx_audio_item_id on public.audio (item_id);

-- Private storage bucket for audio blobs
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

-- ============================================================
-- AUDIO TABLE RLS (session ownership, same as items/photos)
-- ============================================================

-- Admins full access
drop policy if exists "Admins full access to audio" on public.audio;
create policy "Admins full access to audio"
  on public.audio for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists view audio in their sessions
drop policy if exists "Specialists view own audio" on public.audio;
create policy "Specialists view own audio"
  on public.audio for select
  to authenticated
  using (
    exists (
      select 1 from public.items i
      join public.sessions s on s.id = i.session_id
      where i.id = item_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists insert audio for their items
drop policy if exists "Specialists create own audio" on public.audio;
create policy "Specialists create own audio"
  on public.audio for insert
  to authenticated
  with check (
    exists (
      select 1 from public.items i
      join public.sessions s on s.id = i.session_id
      where i.id = item_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists delete own audio (D-04 hard-delete orphan close)
drop policy if exists "Specialists delete own audio" on public.audio;
create policy "Specialists delete own audio"
  on public.audio for delete
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
-- STORAGE BUCKET RLS (on storage.objects, bucket_id = 'audio')
-- Column-qualified storage.foldername(storage.objects.name) ON EVERY policy —
-- never bare `name` (Pitfall 1 / the Phase 31 photo bug). sessionId = path token [2].
-- ============================================================

-- ADMIN: full access to the audio bucket
drop policy if exists "Admins full access to audio objects" on storage.objects;
create policy "Admins full access to audio objects"
  on storage.objects for all
  to authenticated
  using ( bucket_id = 'audio' and (select private.is_admin()) )
  with check ( bucket_id = 'audio' and (select private.is_admin()) );

-- SPECIALIST: scoped to blobs under sessions they own (created_by/assigned_to).
drop policy if exists "Specialists read own audio objects" on storage.objects;
create policy "Specialists read own audio objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'audio'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

drop policy if exists "Specialists upload own audio objects" on storage.objects;
create policy "Specialists upload own audio objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'audio'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- UPDATE required: supabase.storage upload({ upsert: true }) issues an UPDATE on
-- retry. Both the existing row (using) and the new values (with check) are scoped.
drop policy if exists "Specialists overwrite own audio objects" on storage.objects;
create policy "Specialists overwrite own audio objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'audio'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'audio'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- DELETE (D-04): owner can remove their own audio blob.
drop policy if exists "Specialists delete own audio objects" on storage.objects;
create policy "Specialists delete own audio objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'audio'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- ============================================================
-- D-07: retention baseline column on items.
-- Nullable; set when an item's cataloging is finalized. The purge clock (D-03)
-- keys on this, NOT created_at — items live until they're done + 30 days.
-- ============================================================
alter table public.items add column if not exists completed_at timestamptz;

-- ============================================================
-- D-08: scheduled retention + orphan sweep.
-- pg_cron drives the cadence; pg_net POSTs to the purge-audio edge function,
-- which (service-role) computes the expired/orphaned path set itself and calls
-- storage.from('audio').remove(). The cron body MUST NOT run
-- `DELETE FROM storage.objects` — that drops the metadata row but orphans the S3
-- binary (the exact photo leak D-04 closes).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Daily at 03:00 UTC — off-peak; audio retention is a slow 30-day clock so a
-- once-a-day sweep is ample and keeps pg_net traffic minimal.
-- The edge function URL + service/cron secret are injected via the project's
-- current_setting / Vault config at apply time (plan 02); placeholders below are
-- replaced during the prod push so no secret is committed to the repo.
-- cron.schedule upserts by jobname, but unschedule-if-present keeps reruns clean
-- even across pg_cron versions with stricter create semantics.
select cron.unschedule('purge-old-audio')
where exists (select 1 from cron.job where jobname = 'purge-old-audio');
select cron.schedule(
  'purge-old-audio',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.settings.purge_audio_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purge-secret', current_setting('app.settings.purge_audio_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
