-- SEC-4: storage-bucket RLS ownership scoping.
-- The original photos-bucket policies (20260320200000_create_photos.sql:76-85)
-- gated only on bucket_id = 'photos', so any authenticated specialist could
-- read or overwrite (upsert) another specialist's blobs by path. The photos
-- *table* RLS is already session-scoped; this migration brings storage.objects
-- to the same ownership model.
--
-- Path convention (photoUploadQueue.ts): photos/{sessionId}/{itemId}/<file>.jpg
-- => storage.foldername(name) = {photos, sessionId, itemId}; sessionId = [2].
-- Ownership mirrors the photos-table policy: the session in the path must be
-- created_by or assigned_to the caller. Admins keep full access.
-- See _workspace/Urgent + audit-consolidated-backlog-2026-05-27.md, D-046, D-051.

-- Drop the over-permissive originals.
drop policy if exists "Users can upload photos" on storage.objects;
drop policy if exists "Users can read photos" on storage.objects;

-- ============================================================
-- ADMIN: full access to the photos bucket
-- ============================================================
create policy "Admins full access to photo objects"
  on storage.objects for all
  to authenticated
  using ( bucket_id = 'photos' and (select private.is_admin()) )
  with check ( bucket_id = 'photos' and (select private.is_admin()) );

-- ============================================================
-- SPECIALIST: scoped to blobs under sessions they own
-- (created_by or assigned_to), keyed on path token [2] = sessionId.
-- ============================================================
create policy "Specialists read own photo objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

create policy "Specialists upload own photo objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- UPDATE required: supabase.storage upload({ upsert: true }) UPDATEs an existing
-- object. Both the existing row (using) and the new values (with check) are scoped.
create policy "Specialists overwrite own photo objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

create policy "Specialists delete own photo objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );
