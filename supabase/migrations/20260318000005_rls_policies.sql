-- ============================================================
-- PROFILES
-- ============================================================

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = id );

-- Admins can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using ( (select private.is_admin()) );

-- Admins can update any profile (deactivate, change role)
create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using ( (select private.is_admin()) );

-- ============================================================
-- SESSIONS
-- ============================================================

-- Admins have full CRUD on all sessions
create policy "Admins full access to sessions"
  on public.sessions for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists can view sessions assigned to them or created by them
create policy "Specialists view own sessions"
  on public.sessions for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  );

-- Specialists can create sessions (must be their own)
create policy "Specialists create own sessions"
  on public.sessions for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and created_by = (select auth.uid())
  );

-- Specialists can update sessions they own or are assigned to
create policy "Specialists update own sessions"
  on public.sessions for update
  to authenticated
  using (
    (select private.is_active_user())
    and (
      created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  );

-- ============================================================
-- ITEMS
-- ============================================================

-- Admins have full CRUD on all items
create policy "Admins full access to items"
  on public.items for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists can view items belonging to their sessions
create policy "Specialists view own items"
  on public.items for select
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists can insert items into their sessions
create policy "Specialists create own items"
  on public.items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists can update items in their sessions
create policy "Specialists update own items"
  on public.items for update
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- Specialists can delete items in their sessions
create policy "Specialists delete own items"
  on public.items for delete
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );

-- ============================================================
-- EXPORT HISTORY
-- ============================================================

-- Admins have full CRUD on export history
create policy "Admins full access to export_history"
  on public.export_history for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists can view their own export records
create policy "Specialists view own exports"
  on public.export_history for select
  to authenticated
  using ( exported_by = (select auth.uid()) );
