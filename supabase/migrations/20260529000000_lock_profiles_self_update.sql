-- SEC: profiles self-update privilege escalation (P0, live on prod).
-- The self-update policy "Users can update own walkthrough status"
-- (20260320100000_add_walkthrough_completed.sql:7-12) is row-scoped
-- (auth.uid() = id) but NOT column-scoped, and untracked drifted column
-- grants (Supabase defaults, never in a committed migration) give BOTH
-- authenticated AND anon UPDATE on every profiles column -- including role
-- and is_active. So any specialist can self-promote via
-- PATCH /rest/v1/profiles?id=eq.<uid> {role:'admin', is_active:true}.
--
-- Three-part fix:
--   1) Table-form REVOKE UPDATE from authenticated + anon (this also clears
--      ALL column-level grants), then re-GRANT UPDATE only on the two columns
--      the client legitimately self-writes (walkthrough_completed, theme).
--   2) A BEFORE UPDATE guard trigger that raises on any role/is_active change
--      by a non-admin, non-service caller (defense-in-depth vs future re-grant).
--   3) The existing self-update RLS policy is kept as-is (correct once grants
--      are column-scoped).
--
-- See ../_workspace/Urgent/sec-profiles-self-update-escalation.md, D-046
-- (auth/schema is Claude-owned), D-001 (shared Supabase -- global fix),
-- D-003 (anon key is public; RLS + grants are the only boundary).

create schema if not exists private;

-- 1) Revoke drifted broad UPDATE (table-form also clears all column grants),
--    then re-grant only the client-written columns to authenticated.
revoke update on public.profiles from authenticated, anon;
grant update (walkthrough_completed) on public.profiles to authenticated;
-- `theme` (Phase 25) is also a legitimate client self-write, but it is a
-- drift-prone column: the 20260512000000 migration uses ADD COLUMN IF NOT
-- EXISTS and themeStore tolerates its absence (localStorage fallback), so it
-- is NOT present on every environment (e.g. prod as of 2026-05-29). Grant it
-- only where it exists, so this migration applies cleanly regardless of drift
-- and auto-covers `theme` once the column lands.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'theme'
  ) then
    execute 'grant update (theme) on public.profiles to authenticated';
  end if;
end $$;
-- No other column is granted: the user-facing name is server-set at
-- admin-create-user time, not a client self-write (D-02). anon gets nothing back.

-- 2) Defense-in-depth: raise on any role/is_active change unless the caller is
--    the service_role Edge path (admin-update-user, D-06) or an authenticated
--    admin. security invoker so current_user is unambiguously the
--    PostgREST-switched caller; reuse the existing security-definer is_admin().
create or replace function private.guard_profiles_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role)
     or (new.is_active is distinct from old.is_active) then
    if current_user = 'service_role' then return new; end if;
    if (select private.is_admin()) then return new; end if;
    raise exception
      'Only an administrator may change role or is_active (attempted by %).', current_user
      using errcode = '42501';  -- insufficient_privilege -> PostgREST 403-class
  end if;
  return new;
end;
$$;

-- 3) Idempotent trigger (PG15-safe drop-then-create pair).
drop trigger if exists trg_guard_profiles_privileged_columns on public.profiles;
create trigger trg_guard_profiles_privileged_columns
  before update on public.profiles
  for each row execute function private.guard_profiles_privileged_columns();
