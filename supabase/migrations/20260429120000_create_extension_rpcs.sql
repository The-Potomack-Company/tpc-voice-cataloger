-- Phase 2 / EXT-01..10 — Aggregation RPCs for /extension.
-- INVARIANTS (NEVER drop these; the static grep verifier in
-- scripts/verify-extension-app-source-scope.mjs enforces them):
--   D-01: every scoped CTE filters `app_source = 'tpc-extension'`
--   D-02: 5-event vocabulary excludes `catalog_item`
--   D-03: error signal is `error_message IS NOT NULL`
--   D-13: bucketing uses 3-arg `date_trunc('day'|'hour', x, 'America/New_York')`
--   Pitfall 2: empty array filter idiom `(cardinality(p_users) = 0 OR x = any(p_users))`
--   Pitfall 9: every function has explicit `grant execute ... to authenticated`
--
-- All 6 functions are `language sql stable security invoker` so the existing
-- `analytics_admin_select` RLS policy (Phase 1 INFR-05) gates row visibility
-- via the calling JWT's role context. anon and non-admin authenticated users
-- get zero rows; admins see the full extension-scoped event stream.
--
-- D-22: this migration does NOT alter `public.analytics_events`. Schema shape
-- is owned by the extension repo. Do not add columns or policies here.

-- ----------------------------------------------------------------------------
-- Function 1 — get_event_volume_daily (EXT-01)
--   Per-bucket × per-event_type counts, with zero-cells filled by
--   generate_series × unnest(types) so stacked bars render gaps as zeros.
--   p_bucket toggles between 'day' (default) and 'hour' for D-08 today range.
-- ----------------------------------------------------------------------------
create or replace function public.get_event_volume_daily(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[],
  p_bucket   text     default 'day'
) returns table (
  bucket_start timestamptz,
  event_type   text,
  event_count  bigint
)
language sql
stable
security invoker
as $$
  with bucket_unit as (
    select case when p_bucket = 'hour' then 'hour' else 'day' end as unit,
           case when p_bucket = 'hour' then interval '1 hour' else interval '1 day' end as step
  ),
  buckets as (
    select generate_series(
      date_trunc((select unit from bucket_unit), p_from, 'America/New_York'),
      date_trunc((select unit from bucket_unit), p_to,   'America/New_York'),
      (select step from bucket_unit)
    )::timestamptz as bucket_start
  ),
  types as (
    select unnest(array[
      'catalog_single', 'catalog_batch', 'portal_upload',
      'spreadsheet_transform', 'data_import'
    ]) as event_type
  ),
  scoped as (
    select
      date_trunc((select unit from bucket_unit), created_at, 'America/New_York') as bucket_start,
      event_type
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in (
        'catalog_single', 'catalog_batch', 'portal_upload',
        'spreadsheet_transform', 'data_import'
      )
      and created_at >= date_trunc((select unit from bucket_unit), p_from, 'America/New_York')
      and created_at <  date_trunc((select unit from bucket_unit), p_to,   'America/New_York') + (select step from bucket_unit)
      and (cardinality(p_users)    = 0 or user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  )
  select
    b.bucket_start,
    t.event_type,
    coalesce(count(s.*), 0)::bigint as event_count
  from buckets b
  cross join types t
  left join scoped s
    on s.bucket_start = b.bucket_start and s.event_type = t.event_type
  group by b.bucket_start, t.event_type
  order by b.bucket_start, t.event_type;
$$;

grant execute on function public.get_event_volume_daily(
  timestamptz, timestamptz, text[], text[], text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 2 — get_kpi_totals (EXT-02)
--   One row per event_type with current_count, previous_count, and a JSONB
--   sparkline series. Previous period = same length, immediately preceding
--   (D-05): prev_from = p_from - (p_to - p_from), prev_to = p_from.
--   Sparkline buckets respect p_bucket ('day' | 'hour') for D-08.
-- ----------------------------------------------------------------------------
create or replace function public.get_kpi_totals(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[],
  p_bucket   text     default 'day'
) returns table (
  event_type      text,
  current_count   bigint,
  previous_count  bigint,
  sparkline       jsonb
)
language sql
stable
security invoker
as $$
  with bounds as (
    select
      p_from                       as cur_from,
      p_to                         as cur_to,
      p_from - (p_to - p_from)     as prev_from,
      p_from                       as prev_to,
      case when p_bucket = 'hour' then 'hour' else 'day' end as unit
  ),
  types as (
    select unnest(array[
      'catalog_single', 'catalog_batch', 'portal_upload',
      'spreadsheet_transform', 'data_import'
    ]) as event_type
  ),
  scoped as (
    select
      ae.event_type,
      ae.created_at,
      case when ae.created_at >= b.cur_from  and ae.created_at < b.cur_to  then 'cur'
           when ae.created_at >= b.prev_from and ae.created_at < b.prev_to then 'prev'
      end as period
    from public.analytics_events ae
    cross join bounds b
    where ae.app_source = 'tpc-extension'
      and ae.event_type in (
        'catalog_single', 'catalog_batch', 'portal_upload',
        'spreadsheet_transform', 'data_import'
      )
      and ae.created_at >= b.prev_from
      and ae.created_at <  b.cur_to
      and (cardinality(p_users)    = 0 or ae.user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or ae.extension_version = any(p_versions))
  ),
  totals as (
    select
      event_type,
      count(*) filter (where period = 'cur')  as current_count,
      count(*) filter (where period = 'prev') as previous_count
    from scoped
    group by event_type
  ),
  sparks as (
    select
      event_type,
      jsonb_agg(
        jsonb_build_object('x', bucket_start, 'y', cnt)
        order by bucket_start
      ) as sparkline
    from (
      select
        s.event_type,
        date_trunc((select unit from bounds), s.created_at, 'America/New_York') as bucket_start,
        count(*) as cnt
      from scoped s
      where s.period = 'cur'
      group by 1, 2
    ) inner_buckets
    group by event_type
  )
  select
    t.event_type,
    coalesce(tot.current_count,  0)::bigint                    as current_count,
    coalesce(tot.previous_count, 0)::bigint                    as previous_count,
    coalesce(s.sparkline, '[]'::jsonb)                         as sparkline
  from types t
  left join totals tot using (event_type)
  left join sparks s   using (event_type)
  order by t.event_type;
$$;

grant execute on function public.get_kpi_totals(
  timestamptz, timestamptz, text[], text[], text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 3 — get_error_rate_by_type (EXT-03)
--   One row per event_type with errors / total / rate. Rate uses div-by-zero
--   guard via `case when count(*) = 0 then 0 else round(...) end`.
--   Error signal per D-03: `error_message is not null`.
-- ----------------------------------------------------------------------------
create or replace function public.get_error_rate_by_type(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[]
) returns table (
  event_type text,
  errors     bigint,
  total      bigint,
  rate       numeric
)
language sql
stable
security invoker
as $$
  with scoped as (
    select event_type, error_message
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in (
        'catalog_single', 'catalog_batch', 'portal_upload',
        'spreadsheet_transform', 'data_import'
      )
      and created_at >= p_from
      and created_at <  p_to
      and (cardinality(p_users)    = 0 or user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  )
  select
    event_type,
    count(*) filter (where error_message is not null)::bigint as errors,
    count(*)::bigint                                           as total,
    case when count(*) = 0 then 0
         else round(
           count(*) filter (where error_message is not null)::numeric
             / count(*)::numeric,
           4
         )
    end as rate
  from scoped
  group by event_type
  order by event_type;
$$;

grant execute on function public.get_error_rate_by_type(
  timestamptz, timestamptz, text[], text[]
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 4 — get_per_user_summary (EXT-04)
--   One row per user_email (NULL bucketed as 'Unknown' per D-04). Wide pivot
--   over the 5 event types + total_errors + last_seen_at. Sorted newest first.
-- ----------------------------------------------------------------------------
create or replace function public.get_per_user_summary(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[]
) returns table (
  user_email_label      text,
  catalog_single        bigint,
  catalog_batch         bigint,
  portal_upload         bigint,
  spreadsheet_transform bigint,
  data_import           bigint,
  total_errors          bigint,
  last_seen_at          timestamptz
)
language sql
stable
security invoker
as $$
  with scoped as (
    select
      coalesce(user_email, 'Unknown') as user_email_label,
      event_type,
      error_message,
      created_at
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in (
        'catalog_single', 'catalog_batch', 'portal_upload',
        'spreadsheet_transform', 'data_import'
      )
      and created_at >= p_from
      and created_at <  p_to
      and (cardinality(p_users)    = 0 or coalesce(user_email, 'Unknown') = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version               = any(p_versions))
  )
  select
    user_email_label,
    count(*) filter (where event_type = 'catalog_single')::bigint        as catalog_single,
    count(*) filter (where event_type = 'catalog_batch')::bigint         as catalog_batch,
    count(*) filter (where event_type = 'portal_upload')::bigint         as portal_upload,
    count(*) filter (where event_type = 'spreadsheet_transform')::bigint as spreadsheet_transform,
    count(*) filter (where event_type = 'data_import')::bigint           as data_import,
    count(*) filter (where error_message is not null)::bigint            as total_errors,
    max(created_at)                                                       as last_seen_at
  from scoped
  group by user_email_label
  order by max(created_at) desc nulls last;
$$;

grant execute on function public.get_per_user_summary(
  timestamptz, timestamptz, text[], text[]
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 5 — get_dominant_version (EXT-09, dev-panel)
--   Returns a single row: the extension_version with the most rows under the
--   active filter selection. Tie-breaker: latest semver via numeric-aware
--   string_to_array() desc; lexicographic fallback for non-numeric suffixes
--   is acceptable (Open Question 5).
-- ----------------------------------------------------------------------------
create or replace function public.get_dominant_version(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[]
) returns table (
  extension_version text,
  event_count       bigint
)
language sql
stable
security invoker
as $$
  with scoped as (
    select extension_version
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type in (
        'catalog_single', 'catalog_batch', 'portal_upload',
        'spreadsheet_transform', 'data_import'
      )
      and created_at >= p_from
      and created_at <  p_to
      and (cardinality(p_users)    = 0 or user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  )
  select
    extension_version,
    count(*)::bigint as event_count
  from scoped
  where extension_version is not null
  group by extension_version
  order by
    count(*) desc,
    string_to_array(extension_version, '.') desc nulls last
  limit 1;
$$;

grant execute on function public.get_dominant_version(
  timestamptz, timestamptz, text[], text[]
) to authenticated;

-- ----------------------------------------------------------------------------
-- Function 6 — get_cancellation_rates (EXT-10, dev-panel)
--   Per-event-type cancellation rate for catalog_batch (W2) and portal_upload
--   (W3). Returns BOTH rows even when one period has zero events (left-join
--   to a 2-row VALUES list keeps the UI 2-card slot stable).
--
--   `previous_rate` uses the same D-05 semantics as get_kpi_totals:
--     prev_from = p_from - (p_to - p_from), prev_to = p_from.
--   NULLIF(prev_total, 0) → divide-by-zero yields SQL NULL → JS sees `null`,
--   which CancellationRateKpis (Plan 02-07) reads as "no delta, omit chip".
-- ----------------------------------------------------------------------------
create or replace function public.get_cancellation_rates(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[]   default array[]::text[],
  p_versions text[]   default array[]::text[]
) returns table (
  event_type      text,
  cancelled_count bigint,
  total_count     bigint,
  rate            numeric,
  previous_rate   numeric
)
language sql
stable
security invoker
as $$
  with bounds as (
    -- D-05 — same length, immediately preceding (mirrors get_kpi_totals)
    select
      p_from                       as cur_from,
      p_to                         as cur_to,
      p_from - (p_to - p_from)     as prev_from,
      p_from                       as prev_to
  ),
  scoped as (
    -- D-01 — every CTE narrows to extension rows
    select ae.event_type, ae.cancelled, ae.created_at
    from public.analytics_events ae
    cross join bounds b
    where ae.app_source = 'tpc-extension'
      and ae.event_type in ('catalog_batch', 'portal_upload')
      and (cardinality(p_users)    = 0 or ae.user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or ae.extension_version = any(p_versions))
      and ae.created_at >= b.prev_from
      and ae.created_at <  b.cur_to
  ),
  cur as (
    select
      s.event_type,
      count(*) filter (where s.cancelled = true) as cancelled_count,
      count(*)                                    as total_count
    from scoped s
    cross join bounds b
    where s.created_at >= b.cur_from and s.created_at < b.cur_to
    group by s.event_type
  ),
  prev as (
    select
      s.event_type,
      count(*) filter (where s.cancelled = true)::numeric as prev_cancelled,
      count(*)::numeric                                    as prev_total
    from scoped s
    cross join bounds b
    where s.created_at >= b.prev_from and s.created_at < b.prev_to
    group by s.event_type
  ),
  -- Both target event types appear in output even when one period has zero rows.
  types(event_type) as (values ('catalog_batch'), ('portal_upload'))
  select
    t.event_type,
    coalesce(c.cancelled_count, 0)::bigint as cancelled_count,
    coalesce(c.total_count,     0)::bigint as total_count,
    case when coalesce(c.total_count, 0) = 0
         then 0::numeric
         else round(coalesce(c.cancelled_count, 0)::numeric / c.total_count::numeric, 4)
    end                                    as rate,
    -- previous_rate — NULLIF makes denominator=0 yield NULL → JS sees null
    round(
      coalesce(p.prev_cancelled, 0) / nullif(p.prev_total, 0),
      4
    )::numeric                             as previous_rate
  from types t
  left join cur  c on c.event_type = t.event_type
  left join prev p on p.event_type = t.event_type
  order by t.event_type;
$$;

grant execute on function public.get_cancellation_rates(
  timestamptz, timestamptz, text[], text[]
) to authenticated;
