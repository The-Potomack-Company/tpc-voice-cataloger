-- Private schema for internal helper functions (not exposed via PostgREST).
-- Idempotent: TPC App has an identical function; `create or replace` makes this a no-op on the second codebase's push.
create schema if not exists private;

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
