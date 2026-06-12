create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'cataloger_api') then
    create role cataloger_api nologin;
  end if;
end $$;

-- NOINHERIT: the connection role must hold these roles only via SET ROLE
-- (PostgREST switching), never passively — keeps the privilege boundary.
alter role cataloger_app noinherit;
grant anon, authenticated to cataloger_app;
grant usage on schema public to anon, authenticated, cataloger_api;
grant usage on schema private to authenticated, cataloger_api;

create or replace function private.jwt_claim(claim text)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim,
    nullif(current_setting('request.jwt.claim.' || claim, true), '')
  );
$$;

create or replace function private.jwt_uid()
returns text
language sql
stable
as $$
  select private.jwt_claim('uid');
$$;

create or replace function private.jwt_workspace()
returns text
language sql
stable
as $$
  select private.jwt_claim('workspace');
$$;

create or replace function public.require_workspace_claim()
returns void
language plpgsql
stable
as $$
begin
  if current_user = 'authenticated'
     and private.jwt_workspace() is distinct from 'potomackco.com' then
    raise insufficient_privilege using message = 'Firebase workspace claim required';
  end if;
end;
$$;

revoke all on function public.require_workspace_claim() from public;
grant execute on function public.require_workspace_claim() to anon, authenticated, cataloger_api;
