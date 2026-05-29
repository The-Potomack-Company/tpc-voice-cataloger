-- V-1: assert that broad UPDATE grants on public.profiles are gone.
-- Authorized prod read (D-08); run against prod in Plan 31-02 after the
-- 20260529000000_lock_profiles_self_update.sql migration applies.
-- Source: information_schema standard + 31-RESEARCH.md §Code Examples.

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('authenticated', 'anon') and privilege_type = 'UPDATE'
order by grantee, column_name;

-- EXPECT after migration: exactly two rows --
--   ('authenticated', 'UPDATE', 'theme')
--   ('authenticated', 'UPDATE', 'walkthrough_completed')
-- and NO rows for anon, and NO rows for role or is_active.
