-- D-038 dev-data RLS filter.
-- Adds private.dev_users, helper predicates, and RESTRICTIVE policies so dev
-- rows cannot leak through existing permissive admin policies.
--
-- Ported verbatim from tpc-hub/supabase/migrations/20260519000000_dev_users_filter.sql
-- under a fresh timestamp to preserve voice-cataloger's local migration ordering.
-- The hub milestone is paused so this is the first push of D-038 to prod
-- (project wgrknodfxdjtddsirldw, shared across all TPC apps).
--
-- Restrictive policy rationale: Postgres ORs permissive policies and ANDs
-- restrictive policies. D-038 requires AND composition so existing broad admin
-- policies cannot bypass this dev-data boundary.
--
-- D-038-MANIFEST-BEGIN
-- {
--   "user_scoped_tables": [
--     {"table": "public.sessions",         "policy": "sessions_no_dev_data_for_non_dev_viewers",         "via": "created_by"},
--     {"table": "public.items",            "policy": "items_no_dev_data_for_non_dev_viewers",            "via": "session_id->sessions.created_by"},
--     {"table": "public.photos",           "policy": "photos_no_dev_data_for_non_dev_viewers",           "via": "item_id->items.session_id->sessions.created_by"},
--     {"table": "public.export_history",   "policy": "export_history_no_dev_data_for_non_dev_viewers",   "via": "exported_by"},
--     {"table": "public.ui_interactions",  "policy": "ui_interactions_no_dev_data_for_non_dev_viewers",  "via": "user_id"},
--     {"table": "public.analytics_events", "policy": "analytics_events_no_dev_data_for_non_dev_viewers", "via": "user_email"},
--     {"table": "public.profiles",         "policy": "profiles_no_dev_data_for_non_dev_viewers",         "via": "id = auth.users.id"}
--   ]
-- }
-- D-038-MANIFEST-END

create schema if not exists private;

create table if not exists private.dev_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  added_at timestamptz not null default now()
);

create or replace function private.classify_dev_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.email is null
     or new.email = ''
     or lower(new.email) = 'josh@potomackco.com'
  then
    insert into private.dev_users (user_id, reason)
    values (
      new.id,
      case
        when new.email is null then 'auto: null email'
        when new.email = '' then 'auto: empty email'
        else 'auto: known dev email'
      end
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_dev_classify'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_dev_classify
      after insert or update of email on auth.users
      for each row execute procedure private.classify_dev_user();
  end if;
end;
$$;

-- Conditional seed: only insert if the Josh row exists in auth.users.
-- Local supabase db reset starts with empty auth.users → unconditional
-- insert would violate the dev_users_user_id_fkey FK. On prod the user
-- exists (confirmed via select on auth.users 2026-05-28) and the trigger
-- on auth.users.email upserts dev users on signup anyway, so this seed
-- is only meaningful when Josh's auth.users row predates the migration.
insert into private.dev_users (user_id, reason)
select 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd', 'manual seed: D-038 migration'
where exists (select 1 from auth.users where id = 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd')
on conflict (user_id) do nothing;

create or replace function private.is_dev_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from private.dev_users where user_id = uid);
$$;

create or replace function private.is_dev_email(addr text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from auth.users u
    join private.dev_users d on d.user_id = u.id
    where lower(u.email) = lower(addr)
  );
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'sessions_no_dev_data_for_non_dev_viewers'
  ) then
    create policy "sessions_no_dev_data_for_non_dev_viewers"
      on public.sessions
      as restrictive
      for all
      to authenticated
      using (
        created_by = (select auth.uid())
        or (created_by is not null and not private.is_dev_user(created_by))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'items'
      and policyname = 'items_no_dev_data_for_non_dev_viewers'
  ) then
    create policy "items_no_dev_data_for_non_dev_viewers"
      on public.items
      as restrictive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.sessions s
          where s.id = items.session_id
            and (
              s.created_by = (select auth.uid())
              or (s.created_by is not null and not private.is_dev_user(s.created_by))
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'photos_no_dev_data_for_non_dev_viewers'
  ) then
    create policy "photos_no_dev_data_for_non_dev_viewers"
      on public.photos
      as restrictive
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.items i
          join public.sessions s on s.id = i.session_id
          where i.id = photos.item_id
            and (
              s.created_by = (select auth.uid())
              or (s.created_by is not null and not private.is_dev_user(s.created_by))
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'export_history'
      and policyname = 'export_history_no_dev_data_for_non_dev_viewers'
  ) then
    create policy "export_history_no_dev_data_for_non_dev_viewers"
      on public.export_history
      as restrictive
      for all
      to authenticated
      using (
        exported_by = (select auth.uid())
        or (exported_by is not null and not private.is_dev_user(exported_by))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ui_interactions'
      and policyname = 'ui_interactions_no_dev_data_for_non_dev_viewers'
  ) then
    create policy "ui_interactions_no_dev_data_for_non_dev_viewers"
      on public.ui_interactions
      as restrictive
      for all
      to authenticated
      using (
        user_id = (select auth.uid())
        or (user_id is not null and not private.is_dev_user(user_id))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'analytics_events_no_dev_data_for_non_dev_viewers'
  ) then
    create policy "analytics_events_no_dev_data_for_non_dev_viewers"
      on public.analytics_events
      as restrictive
      for select
      to authenticated
      using (
        user_email is not null
        and not private.is_dev_email(user_email)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_no_dev_data_for_non_dev_viewers'
  ) then
    create policy "profiles_no_dev_data_for_non_dev_viewers"
      on public.profiles
      as restrictive
      for all
      to authenticated
      using (
        id = (select auth.uid())
        or not private.is_dev_user(id)
      );
  end if;
end;
$$;
