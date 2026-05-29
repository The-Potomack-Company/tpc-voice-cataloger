-- SEC-4 follow-up: fix column-scope collision in photo-bucket RLS policies.
--
-- The four "Specialists * own photo objects" policies wrote
-- `storage.foldername(name)` inside a subquery `from public.sessions s`.
-- Postgres bound the unqualified `name` to `s.name` (the session's text
-- label, e.g. "Test") instead of the outer `storage.objects.name` (the
-- file path). foldername of a label returns an empty array → policy
-- always denied, including for the owning specialist on their own
-- session. Caught during UAT 2026-05-28 when uat-b could not upload to
-- their own session.
--
-- Fix: drop and recreate all four policies with `storage.objects.name`
-- fully qualified so the file-path-based scoping actually evaluates.
-- Admin policy untouched (it doesn't reference foldername).

drop policy if exists "Specialists read own photo objects"      on storage.objects;
drop policy if exists "Specialists upload own photo objects"    on storage.objects;
drop policy if exists "Specialists overwrite own photo objects" on storage.objects;
drop policy if exists "Specialists delete own photo objects"    on storage.objects;

create policy "Specialists read own photo objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
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
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

create policy "Specialists overwrite own photo objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(storage.objects.name))[2]
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
      where s.id::text = (storage.foldername(storage.objects.name))[2]
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );
