create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.jwt_workspace() = 'potomackco.com'
    and exists (
      select 1 from public.profiles
      where id = private.jwt_uid()
        and is_active = true
    );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.jwt_workspace() = 'potomackco.com'
    and exists (
      select 1 from public.profiles
      where id = private.jwt_uid()
        and role in ('dev', 'admin')
        and is_active = true
    );
$$;

create or replace function private.can_review()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.jwt_workspace() = 'potomackco.com'
    and exists (
      select 1 from public.profiles
      where id = private.jwt_uid()
        and role in ('dev', 'admin', 'manager')
        and is_active = true
    );
$$;

create or replace function private.owns_session(session_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = session_id
      and (s.created_by = private.jwt_uid() or s.assigned_to = private.jwt_uid())
  );
$$;

create or replace function private.owns_item(item_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.items i
    where i.id = item_id
      and private.owns_session(i.session_id)
  );
$$;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (private.is_active_user() and id = private.jwt_uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select to authenticated
  using (private.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists profiles_update_own_preferences on public.profiles;
create policy profiles_update_own_preferences
  on public.profiles for update to authenticated
  using (private.is_active_user() and id = private.jwt_uid())
  with check (private.is_active_user() and id = private.jwt_uid());

drop policy if exists sessions_admin_all on public.sessions;
create policy sessions_admin_all
  on public.sessions for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists sessions_specialist_select on public.sessions;
create policy sessions_specialist_select
  on public.sessions for select to authenticated
  using (
    private.is_active_user()
    and (created_by = private.jwt_uid() or assigned_to = private.jwt_uid())
  );

drop policy if exists sessions_reviewer_select on public.sessions;
create policy sessions_reviewer_select
  on public.sessions for select to authenticated
  using (private.can_review());

drop policy if exists sessions_specialist_insert on public.sessions;
create policy sessions_specialist_insert
  on public.sessions for insert to authenticated
  with check (private.is_active_user() and created_by = private.jwt_uid());

drop policy if exists sessions_specialist_update on public.sessions;
create policy sessions_specialist_update
  on public.sessions for update to authenticated
  using (
    private.is_active_user()
    and (created_by = private.jwt_uid() or assigned_to = private.jwt_uid())
  );

drop policy if exists sessions_specialist_delete on public.sessions;
create policy sessions_specialist_delete
  on public.sessions for delete to authenticated
  using (private.is_active_user() and created_by = private.jwt_uid());

drop policy if exists items_admin_all on public.items;
create policy items_admin_all
  on public.items for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists items_specialist_select on public.items;
create policy items_specialist_select
  on public.items for select to authenticated
  using (private.is_active_user() and private.owns_session(session_id));

drop policy if exists items_reviewer_select on public.items;
create policy items_reviewer_select
  on public.items for select to authenticated
  using (private.can_review());

drop policy if exists items_reviewer_insert on public.items;
create policy items_reviewer_insert
  on public.items for insert to authenticated
  with check (private.can_review());

drop policy if exists items_specialist_insert on public.items;
create policy items_specialist_insert
  on public.items for insert to authenticated
  with check (private.is_active_user() and private.owns_session(session_id));

drop policy if exists items_specialist_update on public.items;
create policy items_specialist_update
  on public.items for update to authenticated
  using (private.is_active_user() and private.owns_session(session_id));

drop policy if exists items_specialist_delete on public.items;
create policy items_specialist_delete
  on public.items for delete to authenticated
  using (private.is_active_user() and private.owns_session(session_id));

drop policy if exists photos_admin_all on public.photos;
create policy photos_admin_all
  on public.photos for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists photos_specialist_select on public.photos;
create policy photos_specialist_select
  on public.photos for select to authenticated
  using (private.is_active_user() and private.owns_item(item_id));

drop policy if exists photos_specialist_insert on public.photos;
create policy photos_specialist_insert
  on public.photos for insert to authenticated
  with check (private.is_active_user() and private.owns_item(item_id));

drop policy if exists photos_specialist_delete on public.photos;
create policy photos_specialist_delete
  on public.photos for delete to authenticated
  using (private.is_active_user() and private.owns_item(item_id));

drop policy if exists audio_admin_all on public.audio;
create policy audio_admin_all
  on public.audio for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists audio_specialist_select on public.audio;
create policy audio_specialist_select
  on public.audio for select to authenticated
  using (private.is_active_user() and private.owns_item(item_id));

drop policy if exists audio_specialist_insert on public.audio;
create policy audio_specialist_insert
  on public.audio for insert to authenticated
  with check (private.is_active_user() and private.owns_item(item_id));

drop policy if exists audio_specialist_delete on public.audio;
create policy audio_specialist_delete
  on public.audio for delete to authenticated
  using (private.is_active_user() and private.owns_item(item_id));

drop policy if exists export_history_admin_all on public.export_history;
create policy export_history_admin_all
  on public.export_history for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists export_history_reviewer_insert on public.export_history;
create policy export_history_reviewer_insert
  on public.export_history for insert to authenticated
  with check (private.can_review());

drop policy if exists export_history_specialist_select on public.export_history;
create policy export_history_specialist_select
  on public.export_history for select to authenticated
  using (private.is_active_user() and exported_by = private.jwt_uid());

drop policy if exists analytics_insert_anon on public.analytics_events;
create policy analytics_insert_anon
  on public.analytics_events for insert to anon
  with check (true);

drop policy if exists analytics_insert_authenticated on public.analytics_events;
create policy analytics_insert_authenticated
  on public.analytics_events for insert to authenticated
  with check (private.jwt_workspace() = 'potomackco.com');

drop policy if exists analytics_admin_select on public.analytics_events;
create policy analytics_admin_select
  on public.analytics_events for select to authenticated
  using (private.is_admin());

grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, delete on public.photos to authenticated;
grant select, insert, delete on public.audio to authenticated;
grant select, insert on public.export_history to authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;
grant select on public.profiles to authenticated;
grant update (walkthrough_completed, theme) on public.profiles to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.sessions,
  public.items,
  public.photos,
  public.audio,
  public.export_history,
  public.analytics_events
to cataloger_api;
