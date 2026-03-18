-- Private schema for internal helper functions (not exposed via PostgREST API)
create schema if not exists private;

-- Check if current user is an active admin
create or replace function private.is_admin()
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active = true
  );
end;
$$;

-- Check if current user is active (any role)
create or replace function private.is_active_user()
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
  );
end;
$$;

-- Auto-create profiles row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'User'),
    coalesce(new.raw_user_meta_data ->> 'role', 'specialist'),
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
