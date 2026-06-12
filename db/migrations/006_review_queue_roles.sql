alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('dev', 'admin', 'manager', 'specialist'));

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

drop policy if exists sessions_reviewer_select on public.sessions;
create policy sessions_reviewer_select
  on public.sessions for select to authenticated
  using (private.can_review());

drop policy if exists items_reviewer_select on public.items;
create policy items_reviewer_select
  on public.items for select to authenticated
  using (private.can_review());

drop policy if exists items_reviewer_insert on public.items;
create policy items_reviewer_insert
  on public.items for insert to authenticated
  with check (private.can_review());

drop policy if exists export_history_reviewer_insert on public.export_history;
create policy export_history_reviewer_insert
  on public.export_history for insert to authenticated
  with check (private.can_review());

drop policy if exists item_drafts_reviewer_all on public.item_drafts;
create policy item_drafts_reviewer_all
  on public.item_drafts for all to authenticated
  using (private.can_review())
  with check (private.can_review());
