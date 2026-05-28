-- Phase 3 / APP-01..12 — Aggregation + raw-shape RPCs for /activity.
-- INVARIANTS (NEVER drop these; the static grep verifiers in
-- scripts/verify-activity-*.mjs enforce them):
--   D-30: every aggregation RPC uses 3-arg date_trunc('day'|'hour', x, 'America/New_York')
--   D-33: every reference to public.ui_interactions filters `app_source = 'tpc-app'`
--   D-20: every mode filter targets `sessions.mode`; NEVER `items.mode`
--   D-24: get_stuck_items hard-codes `interval '2 hours'` — NOT a parameter
--   D-19: specialist filter resolves `profiles.email = ANY(p_specialists)`; admins excluded by `role = 'specialist'`
--   Pitfall 1: 3-arg date_trunc only — NEVER `(x AT TIME ZONE 'America/New_York')::date`
--   Pitfall 2: empty array filter idiom `(cardinality(p_specialists) = 0 OR profiles.email = ANY(p_specialists))`
--   Pitfall 5: URL filter param is email; server-side join via profiles.id = sessions.assigned_to (auth.users chain)
--   Phase Boundary: this migration MUST NOT INSERT/UPDATE/DELETE/ALTER any TPC App table.
--     New objects = RPCs only. No new columns, no new tables, no new policies on TPC App tables.
--
-- All Phase 3 RPCs are `language sql stable security invoker` so existing TPC App
-- admin-read-all RLS gates row visibility via the calling JWT. anon and non-admin
-- authenticated users get zero rows.

-- ----------------------------------------------------------------------------
-- Function 1 — get_today_kpis (APP-01, D-14)
--   Right-now: today + yesterday paired counts so the UI can render today's
--   strip plus a delta-vs-yesterday chip without a second roundtrip. ET day
--   boundaries via 3-arg date_trunc(... 'America/New_York') (D-30).
--
--   Returns 10 columns in a single row. Items totals split into _done and
--   _total so callers can compute % AI-done KPI client-side.
-- ----------------------------------------------------------------------------
create or replace function public.get_today_kpis(
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  sessions_today    bigint,
  items_today       bigint,
  exports_today     bigint,
  items_done_today  bigint,
  items_total_today bigint,
  sessions_yday     bigint,
  items_yday        bigint,
  exports_yday      bigint,
  items_done_yday   bigint,
  items_total_yday  bigint
)
language sql
stable
security invoker
as $$
  with bounds as (
    select
      date_trunc('day', now(), 'America/New_York')                     as today_from,
      date_trunc('day', now(), 'America/New_York') + interval '1 day'  as today_to,
      date_trunc('day', now(), 'America/New_York') - interval '1 day'  as yday_from,
      date_trunc('day', now(), 'America/New_York')                     as yday_to
  ),
  specialist_ids as (
    select id, email from public.profiles
     where role = 'specialist'
       and is_active = true
       and (cardinality(p_specialists) = 0 or email = any(p_specialists))
  ),
  -- Sessions: count by created_at within bound; mode + specialist scope
  sessions_scoped as (
    select s.id, s.created_at,
           case when s.created_at >= b.today_from and s.created_at < b.today_to then 'today'
                when s.created_at >= b.yday_from  and s.created_at < b.yday_to  then 'yday'
           end as period
    from public.sessions s
    cross join bounds b
    where s.created_at >= b.yday_from and s.created_at < b.today_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or s.assigned_to in (select id from specialist_ids))
  ),
  -- Items: count by created_at within bound; mode filter on sessions.mode (D-20)
  items_scoped as (
    select i.id, i.created_at, i.ai_status,
           case when i.created_at >= b.today_from and i.created_at < b.today_to then 'today'
                when i.created_at >= b.yday_from  and i.created_at < b.yday_to  then 'yday'
           end as period
    from public.items i
    join public.sessions s on s.id = i.session_id
    cross join bounds b
    where i.created_at >= b.yday_from and i.created_at < b.today_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or s.assigned_to in (select id from specialist_ids))
  ),
  -- Exports: count by exported_at within bound
  exports_scoped as (
    select eh.id, eh.exported_at,
           case when eh.exported_at >= b.today_from and eh.exported_at < b.today_to then 'today'
                when eh.exported_at >= b.yday_from  and eh.exported_at < b.yday_to  then 'yday'
           end as period
    from public.export_history eh
    join public.sessions s on s.id = eh.session_id
    cross join bounds b
    where eh.exported_at >= b.yday_from and eh.exported_at < b.today_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or s.assigned_to in (select id from specialist_ids))
  )
  select
    coalesce(count(*) filter (where ss.period = 'today'), 0)::bigint                      as sessions_today,
    coalesce((select count(*) from items_scoped where period = 'today'), 0)::bigint      as items_today,
    coalesce((select count(*) from exports_scoped where period = 'today'), 0)::bigint    as exports_today,
    coalesce((select count(*) from items_scoped where period = 'today' and ai_status = 'done'), 0)::bigint as items_done_today,
    coalesce((select count(*) from items_scoped where period = 'today'), 0)::bigint      as items_total_today,
    coalesce(count(*) filter (where ss.period = 'yday'), 0)::bigint                       as sessions_yday,
    coalesce((select count(*) from items_scoped where period = 'yday'), 0)::bigint       as items_yday,
    coalesce((select count(*) from exports_scoped where period = 'yday'), 0)::bigint     as exports_yday,
    coalesce((select count(*) from items_scoped where period = 'yday' and ai_status = 'done'), 0)::bigint as items_done_yday,
    coalesce((select count(*) from items_scoped where period = 'yday'), 0)::bigint       as items_total_yday
  from sessions_scoped ss;
$$;

grant execute on function public.get_today_kpis(text[], text) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 2 — get_active_sessions (APP-02, D-15)
--   Right-now: one row per `status='active'` session with the assigned
--   specialist's display_name joined server-side (Pitfall 1 — PostgREST cannot
--   resolve the cross-schema FK chain sessions.assigned_to → auth.users → profiles).
-- ----------------------------------------------------------------------------
create or replace function public.get_active_sessions(
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  session_id                uuid,
  name                      text,
  mode                      text,
  status                    text,
  assigned_to_id            uuid,
  assigned_to_display_name  text,
  item_count                bigint,
  created_at                timestamptz,
  updated_at                timestamptz
)
language sql
stable
security invoker
as $$
  select
    s.id                            as session_id,
    s.name,
    s.mode,
    s.status,
    p.id                            as assigned_to_id,
    p.display_name                  as assigned_to_display_name,
    coalesce((select count(*) from public.items i where i.session_id = s.id), 0)::bigint as item_count,
    s.created_at,
    s.updated_at
  from public.sessions s
  left join public.profiles p on p.id = s.assigned_to
  where s.status = 'active'
    and (p_mode = 'all' or s.mode = p_mode)
    and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  order by s.created_at asc;
$$;

grant execute on function public.get_active_sessions(text[], text) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 3 — get_items_per_specialist_14d (APP-03, D-16)
--   Fixed-window: trailing 14 days inclusive of today, ET-bucketed daily.
--   Zero-fill via generate_series × cross join specialists so stacked bars
--   render gaps as zeros (mirrors Phase 2 get_event_volume_daily). 3-arg
--   date_trunc(... 'America/New_York') (D-30).
-- ----------------------------------------------------------------------------
create or replace function public.get_items_per_specialist_14d(
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  bucket_start             timestamptz,
  specialist_id            uuid,
  specialist_email         text,
  specialist_display_name  text,
  item_count               bigint
)
language sql
stable
security invoker
as $$
  with bounds as (
    select
      date_trunc('day', now(), 'America/New_York') - interval '13 days' as window_from,
      date_trunc('day', now(), 'America/New_York') + interval '1 day'   as window_to
  ),
  buckets as (
    select generate_series(
      (select window_from from bounds),
      (select window_from from bounds) + interval '13 days',
      interval '1 day'
    )::timestamptz as bucket_start
  ),
  specialists as (
    select id, email, display_name
    from public.profiles
    where role = 'specialist'
      and is_active = true
      and (cardinality(p_specialists) = 0 or email = any(p_specialists))
  ),
  scoped as (
    select
      date_trunc('day', i.created_at, 'America/New_York') as bucket_start,
      sp.id           as specialist_id,
      sp.email        as specialist_email,
      sp.display_name as specialist_display_name
    from public.items i
    join public.sessions s on s.id = i.session_id
    join specialists sp on sp.id = s.assigned_to
    cross join bounds b
    where i.created_at >= b.window_from
      and i.created_at <  b.window_to
      and (p_mode = 'all' or s.mode = p_mode)
  )
  select
    b.bucket_start,
    sp.id                    as specialist_id,
    sp.email                 as specialist_email,
    sp.display_name          as specialist_display_name,
    coalesce(count(s.*), 0)::bigint as item_count
  from buckets b
  cross join specialists sp
  left join scoped s
    on s.bucket_start = b.bucket_start
   and s.specialist_id = sp.id
  group by b.bucket_start, sp.id, sp.email, sp.display_name
  order by b.bucket_start, sp.display_name nulls last;
$$;

grant execute on function public.get_items_per_specialist_14d(text[], text) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 4 — get_ai_status_distribution (APP-04, D-17)
--   Range-driven on items.created_at; one row per ai_status value (5 always —
--   pending/processing/queued/done/failed) with zero-fill so the donut renders
--   stable slots.
-- ----------------------------------------------------------------------------
create or replace function public.get_ai_status_distribution(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  ai_status   text,
  item_count  bigint
)
language sql
stable
security invoker
as $$
  with statuses(ai_status) as (
    values ('pending'), ('processing'), ('queued'), ('done'), ('failed')
  ),
  scoped as (
    select i.ai_status
    from public.items i
    join public.sessions s on s.id = i.session_id
    left join public.profiles p on p.id = s.assigned_to
    where i.created_at >= p_from
      and i.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  )
  select t.ai_status, coalesce(count(sc.*), 0)::bigint as item_count
  from statuses t
  left join scoped sc on sc.ai_status = t.ai_status
  group by t.ai_status
  order by t.ai_status;
$$;

grant execute on function public.get_ai_status_distribution(
  timestamptz, timestamptz, text[], text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 5 — get_export_pipeline (APP-05, D-17)
--   Range-driven on sessions.created_at; one row per sessions.status value.
--   Includes 'completed' as a 5th segment per RESEARCH Open Q1 (locked: yes —
--   TPC App migration 20260320000000_add_completed_status.sql extended the
--   status enum and prod data uses it).
-- ----------------------------------------------------------------------------
create or replace function public.get_export_pipeline(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  status        text,
  session_count bigint
)
language sql
stable
security invoker
as $$
  with statuses(status) as (
    values ('active'), ('submitted'), ('returned'), ('exported'), ('completed')
  ),
  scoped as (
    select s.status
    from public.sessions s
    left join public.profiles p on p.id = s.assigned_to
    where s.created_at >= p_from
      and s.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  )
  select t.status, coalesce(count(sc.*), 0)::bigint as session_count
  from statuses t
  left join scoped sc on sc.status = t.status
  group by t.status
  order by t.status;
$$;

grant execute on function public.get_export_pipeline(
  timestamptz, timestamptz, text[], text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 6 — get_house_sale_split (APP-12, D-17)
--   Range-driven on sessions.created_at and items.created_at; returns 2 rows
--   (house, sale). Mode filter is intentionally NOT applied here — the UI is
--   responsible for hiding the un-selected mode tile when p_mode ≠ 'all'.
--   Specialist filter applies. Mode filter sourced from sessions.mode (D-20).
-- ----------------------------------------------------------------------------
create or replace function public.get_house_sale_split(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  mode        text,
  n_sessions  bigint,
  n_items     bigint
)
language sql
stable
security invoker
as $$
  with modes(mode) as (
    values ('house'), ('sale')
  ),
  scoped_sessions as (
    select s.mode, s.id
    from public.sessions s
    left join public.profiles p on p.id = s.assigned_to
    where s.created_at >= p_from
      and s.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  ),
  scoped_items as (
    select s.mode, i.id
    from public.items i
    join public.sessions s on s.id = i.session_id
    left join public.profiles p on p.id = s.assigned_to
    where i.created_at >= p_from
      and i.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  )
  select
    m.mode,
    coalesce(count(distinct ss.id), 0)::bigint as n_sessions,
    coalesce(count(si.id),          0)::bigint as n_items
  from modes m
  left join scoped_sessions ss on ss.mode = m.mode
  left join scoped_items    si on si.mode = m.mode
  group by m.mode
  order by m.mode;
$$;

grant execute on function public.get_house_sale_split(
  timestamptz, timestamptz, text[], text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 7 — get_stuck_items (APP-11, D-18, D-24)
--   Right-now: items in 'processing' or 'queued' state for >2 hours.
--   Threshold hard-coded as `interval '2 hours'` (D-24) — NEVER add a
--   p_threshold_* parameter or the alert card and /activity/stuck page will
--   drift. Returns N rows ordered oldest-first.
--
--   Dev-surface columns (D-28) included in return shape: category, estimate,
--   photo_paths. Admin UI hides these; dev UI shows them inside the Raw Item
--   Inspector. Photo paths array filters to upload_status='failed' only —
--   surfaces broken thumbnails for diagnosis (D-13).
-- ----------------------------------------------------------------------------
create or replace function public.get_stuck_items(
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  item_id                  uuid,
  receipt_number           text,
  title                    text,
  ai_status                text,
  created_at               timestamptz,
  age_seconds              bigint,
  session_id               uuid,
  session_name             text,
  specialist_id            uuid,
  specialist_display_name  text,
  category                 text,
  estimate                 text,
  photo_paths              text[]
)
language sql
stable
security invoker
as $$
  select
    i.id              as item_id,
    i.receipt_number,
    i.title,
    i.ai_status,
    i.created_at,
    extract(epoch from (now() - i.created_at))::bigint as age_seconds,
    s.id              as session_id,
    s.name            as session_name,
    p.id              as specialist_id,
    p.display_name    as specialist_display_name,
    i.category,
    i.estimate,
    array(
      select ph.storage_path
      from public.photos ph
      where ph.item_id = i.id
        and ph.upload_status = 'failed'
    )                 as photo_paths
  from public.items i
  join public.sessions s on s.id = i.session_id
  left join public.profiles p on p.id = s.assigned_to
  where i.ai_status in ('processing', 'queued')
    and i.created_at < now() - interval '2 hours'
    and (p_mode = 'all' or s.mode = p_mode)
    and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  order by i.created_at asc;
$$;

grant execute on function public.get_stuck_items(text[], text) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 8 — get_failed_ai_breakdown (D-29)
--   Range-driven on items.created_at where ai_status='failed'. Long-form
--   output: one row per (dimension, dim_key) across three dimensions
--   (specialist, mode, category). Single RPC + dimension column avoids three
--   separate roundtrips for what's effectively the same scoped slice.
-- ----------------------------------------------------------------------------
create or replace function public.get_failed_ai_breakdown(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[] default array[]::text[],
  p_mode        text   default 'all'
) returns table (
  dimension   text,
  dim_key     text,
  dim_label   text,
  item_count  bigint
)
language sql
stable
security invoker
as $$
  with scoped as (
    select
      i.id,
      i.category,
      s.mode,
      p.id           as specialist_id,
      p.display_name as specialist_display_name
    from public.items i
    join public.sessions s on s.id = i.session_id
    left join public.profiles p on p.id = s.assigned_to
    where i.created_at >= p_from
      and i.created_at <  p_to
      and i.ai_status = 'failed'
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
  )
  select 'specialist' as dimension,
         coalesce(specialist_id::text, 'unassigned')   as dim_key,
         coalesce(specialist_display_name, 'Unassigned') as dim_label,
         count(*)::bigint as item_count
  from scoped
  group by specialist_id, specialist_display_name
  union all
  select 'mode' as dimension,
         mode as dim_key,
         mode as dim_label,
         count(*)::bigint
  from scoped
  group by mode
  union all
  select 'category' as dimension,
         coalesce(category, 'uncategorized') as dim_key,
         coalesce(category, 'uncategorized') as dim_label,
         count(*)::bigint
  from scoped
  group by category
  order by dimension, item_count desc;
$$;

grant execute on function public.get_failed_ai_breakdown(
  timestamptz, timestamptz, text[], text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 9 — get_session_detail (APP-09 detail helper)
--   One-shot: single record with both assigned_to and created_by profile
--   joins (Pitfall 1 — PostgREST cannot resolve sessions → auth.users →
--   profiles chain). Used by /activity/sessions/:id page header.
-- ----------------------------------------------------------------------------
create or replace function public.get_session_detail(
  p_session_id uuid
) returns table (
  session_id                uuid,
  name                      text,
  mode                      text,
  status                    text,
  notes                     text,
  review_notes              text,
  assigned_to_id            uuid,
  assigned_to_display_name  text,
  created_by_id             uuid,
  created_by_display_name   text,
  created_at                timestamptz,
  updated_at                timestamptz
)
language sql
stable
security invoker
as $$
  select
    s.id          as session_id,
    s.name,
    s.mode,
    s.status,
    s.notes,
    s.review_notes,
    pa.id         as assigned_to_id,
    pa.display_name as assigned_to_display_name,
    pc.id         as created_by_id,
    pc.display_name as created_by_display_name,
    s.created_at,
    s.updated_at
  from public.sessions s
  left join public.profiles pa on pa.id = s.assigned_to
  left join public.profiles pc on pc.id = s.created_by
  where s.id = p_session_id
  limit 1;
$$;

grant execute on function public.get_session_detail(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 10 — get_photo_coverage (APP-10)
--   One-shot: single record summarizing photo coverage for one session.
--   items_total, items_with_photos (n_photos > 0), items_without_photos, plus
--   per-upload_status counts (pending/uploading/uploaded/failed) for the
--   diagnostic panel above the per-item list.
-- ----------------------------------------------------------------------------
create or replace function public.get_photo_coverage(
  p_session_id uuid
) returns table (
  items_total          bigint,
  items_with_photos    bigint,
  items_without_photos bigint,
  status_pending       bigint,
  status_uploading     bigint,
  status_uploaded      bigint,
  status_failed        bigint
)
language sql
stable
security invoker
as $$
  with item_set as (
    select i.id from public.items i where i.session_id = p_session_id
  ),
  with_photos as (
    select item_id, count(*) as n_photos
    from public.photos
    where item_id in (select id from item_set)
    group by item_id
  ),
  status_counts as (
    select upload_status, count(*) as n
    from public.photos
    where item_id in (select id from item_set)
    group by upload_status
  )
  select
    (select count(*) from item_set)::bigint                                          as items_total,
    (select count(*) from with_photos where n_photos > 0)::bigint                    as items_with_photos,
    ((select count(*) from item_set)
       - (select count(*) from with_photos where n_photos > 0))::bigint              as items_without_photos,
    coalesce((select n from status_counts where upload_status = 'pending'),   0)::bigint as status_pending,
    coalesce((select n from status_counts where upload_status = 'uploading'), 0)::bigint as status_uploading,
    coalesce((select n from status_counts where upload_status = 'uploaded'),  0)::bigint as status_uploaded,
    coalesce((select n from status_counts where upload_status = 'failed'),    0)::bigint as status_failed;
$$;

grant execute on function public.get_photo_coverage(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 11 — get_ui_top_pages (D-32, D-33, D-34)
--   Range-driven on ui_interactions.created_at; D-33 hard-filter
--   `app_source = 'tpc-app'`. NO specialist or mode args (D-34 — dev-panel
--   filter scope is date-only). Top 10 page_paths by view count.
-- ----------------------------------------------------------------------------
create or replace function public.get_ui_top_pages(
  p_from timestamptz,
  p_to   timestamptz
) returns table (
  page_path  text,
  view_count bigint
)
language sql
stable
security invoker
as $$
  select page_path, count(*)::bigint as view_count
  from public.ui_interactions
  where app_source = 'tpc-app'
    and interaction_type = 'view'
    and created_at >= p_from
    and created_at <  p_to
    and page_path is not null
  group by page_path
  order by view_count desc
  limit 10;
$$;

grant execute on function public.get_ui_top_pages(
  timestamptz, timestamptz
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 12 — get_ui_top_elements (D-32, D-33, D-34)
--   Range-driven on ui_interactions.created_at; D-33 hard-filter
--   `app_source = 'tpc-app'`. Top 20 element_ids by click count.
-- ----------------------------------------------------------------------------
create or replace function public.get_ui_top_elements(
  p_from timestamptz,
  p_to   timestamptz
) returns table (
  element_id  text,
  click_count bigint
)
language sql
stable
security invoker
as $$
  select element_id, count(*)::bigint as click_count
  from public.ui_interactions
  where app_source = 'tpc-app'
    and interaction_type = 'click'
    and created_at >= p_from
    and created_at <  p_to
    and element_id is not null
  group by element_id
  order by click_count desc
  limit 20;
$$;

grant execute on function public.get_ui_top_elements(
  timestamptz, timestamptz
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 13 — get_walkthrough_funnel (D-32, D-33)
--   Per-user walkthrough state (NOT a window aggregate) — ignores all date
--   range / specialist / mode filters per D-32. D-33 hard-filter
--   `app_source = 'tpc-app'`. Step list mirrors TPC App canonical step IDs
--   from src/components/walkthrough/walkthroughSteps.tsx (SHARED_STEPS +
--   ADMIN_STEPS + SPECIALIST_STEPS). Distinct user count per step.
--
--   Note: the TPC App `walkthrough_step` interaction_type is declared in
--   src/services/analytics.ts but no emitter calls it yet (verified via grep
--   2026-05-01). When emitters land, the funnel will populate; until then
--   the LEFT JOIN keeps every step row visible with distinct_users = 0.
-- ----------------------------------------------------------------------------
create or replace function public.get_walkthrough_funnel()
returns table (
  step_name      text,
  step_order     int,
  distinct_users bigint
)
language sql
stable
security invoker
as $$
  with steps(step_name, step_order) as (
    values
      -- SHARED_STEPS (ordered as defined in walkthroughSteps.tsx)
      ('welcome',           1),
      ('create-session',    2),
      ('house-visit',       3),
      ('sale-cataloging',   4),
      ('record-item',       5),
      ('ai-processing',     6),
      ('review-edit',       7),
      ('export',            8),
      -- ADMIN_STEPS
      ('admin-accounts',    9),
      ('admin-assign',     10),
      ('admin-review',     11),
      ('admin-import',     12),
      -- SPECIALIST_STEPS
      ('specialist-submit',   13),
      ('specialist-returned', 14)
  ),
  scoped as (
    select user_id, metadata->>'step' as step_name
    from public.ui_interactions
    where app_source = 'tpc-app'
      and interaction_type = 'walkthrough_step'
      and metadata ? 'step'
  )
  select
    s.step_name,
    s.step_order,
    coalesce(count(distinct sc.user_id), 0)::bigint as distinct_users
  from steps s
  left join scoped sc on sc.step_name = s.step_name
  group by s.step_name, s.step_order
  order by s.step_order;
$$;

grant execute on function public.get_walkthrough_funnel() to authenticated;
