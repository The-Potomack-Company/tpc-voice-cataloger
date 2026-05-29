-- D-038 follow-up: grant service_role access to the private schema.
--
-- The original D-038 migration (20260528000000) created `private.dev_users`
-- but never granted USAGE on the schema or SELECT on the table to the
-- Supabase API roles. PostgREST queries via service_role were left unable
-- to read the table even though `private` was exposed in the API's
-- `db_schema` list, breaking admin-list-users at runtime
-- ("permission denied for schema private" / 500 to the client).
--
-- service_role: full read needed for admin-list-users edge fn.
-- authenticated: USAGE on schema only — the SECURITY DEFINER helpers
-- (private.is_dev_user, private.is_dev_email) run as the function owner
-- so direct SELECT on private.dev_users by authenticated is NOT required
-- and is intentionally withheld to keep the dev-user list non-readable
-- to ordinary clients.
-- anon: no access — anonymous clients should not learn about dev users.

grant usage on schema private to service_role;
grant select on private.dev_users to service_role;

grant usage on schema private to authenticated;

-- Future-proof: any new tables added to `private` should default to the
-- same access pattern. Sets default privileges for objects created later
-- by the schema owner (postgres) so we do not have to remember to grant
-- per-table going forward.
alter default privileges in schema private
  grant select on tables to service_role;
