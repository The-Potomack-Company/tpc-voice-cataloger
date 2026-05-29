-- Phase 1 / INFR-02 — Drop v1.0 dashboard-owned objects retired in the
-- 2026-04-24 pivot. Idempotent: drops only what's present. Does NOT touch
-- TPC App tables or the extension's analytics_events.
--
-- To restore: original CREATE statements live in .planning/milestones/
-- v1.0-phases/ (see specifically 01-foundation-auth and 02-pdf-import-pipeline
-- CONTEXT files). This is forensic breadcrumbs, not an automated rollback.
--
-- Discovery (D-05): the concrete drop list was produced by running
-- `npx tsx scripts/discover-drift.ts` against the linked shared-prod project
-- on plan execution date. The table list below is the D-02 baseline
-- (sales, sale_departments, departments, scraper_runs, saved_reports,
-- import_runs) plus any additional remnants observed at discovery time.
-- Each statement uses `if exists` + `cascade` so this migration is a
-- clean no-op on a fresh project or a project where the drop has already
-- been applied.
--
-- NOTE: If Task 1's discovery surfaces additional v1.0 RPCs or views
-- (e.g., insert_sale_with_departments, kpi_summary, department analytics
-- RPCs from v1.0 phases 2/4/5/6), add matching `drop function/view if
-- exists ... cascade` lines below BEFORE the Task 5 push. See Plan 01-01
-- Task 3 action block for the amendment template.

-- Tables (D-02 scope).
drop table if exists public.import_runs cascade;
drop table if exists public.scraper_runs cascade;
drop table if exists public.saved_reports cascade;
drop table if exists public.sale_departments cascade;
drop table if exists public.sales cascade;
drop table if exists public.departments cascade;

-- Functions / RPCs discovered in pg_proc (amend based on Task 1 discovery).
-- Expected v1.0 RPCs (from v1.0-phases/ CONTEXT and migration list):
--   - insert_sale_with_departments(jsonb) — v1.0 Phase 2 atomic per-sale insert
--   - kpi_summary(...) — v1.0 Phase 4 KPI landing
--   - department_* rpcs — v1.0 Phase 6 department analytics
-- The form below drops ALL overloads of a function by name (Postgres 10+):
-- drop function if exists public.<name> cascade;
--
-- Amendment points (uncomment + match Task 1 dropCandidates.functions):
-- drop function if exists public.insert_sale_with_departments cascade;
-- drop function if exists public.refine_import_sale cascade;
-- drop function if exists public.import_sale cascade;
-- drop function if exists public.kpi_summary cascade;
-- drop function if exists public.department_rankings cascade;
-- drop function if exists public.department_share_series cascade;
-- drop function if exists public.department_revenue_series cascade;

-- Views discovered in pg_views (amend based on Task 1 discovery; typically none).
