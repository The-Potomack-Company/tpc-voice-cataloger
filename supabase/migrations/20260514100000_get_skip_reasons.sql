-- ----------------------------------------------------------------------------
-- get_skip_reasons (EXT — Skip Reasons donut on /extension)
--
-- Server-side aggregation of the 5 per-reason skip counters introduced by
-- cataloger migration 007 (analytics_events.skipped_*). Replaces the raw
-- client-side SELECT in fetchSkipReasons, which silently truncated at the
-- PostgREST 1000-row cap once a date range matched enough catalog_batch
-- rows (Codex P2, 2026-05-14).
--
-- Convention matches get_event_volume_daily / get_kpi_totals: long format
-- (one row per reason), security invoker, granted to authenticated.
-- Filters mirror the prior client query exactly:
--   - app_source = 'tpc-extension'             (D-01)
--   - event_type = 'catalog_batch'             (skip reasons live on batch)
--   - created_at between p_from and p_to inclusive
--   - p_users / p_versions: empty array = no filter (Pitfall 2)
--
-- Returns always 5 rows (one per bucket), zero-padded — the donut treats
-- "all five zero" as the lifetime empty-state.
-- ----------------------------------------------------------------------------

create or replace function public.get_skip_reasons(
  p_from     timestamptz,
  p_to       timestamptz,
  p_users    text[] default array[]::text[],
  p_versions text[] default array[]::text[]
) returns table (
  reason text,
  count  bigint
)
language sql
stable
security invoker
as $$
  with totals as (
    select
      coalesce(sum(skipped_no_photos),             0) as no_photos,
      coalesce(sum(skipped_fields_filled),         0) as fields_filled,
      coalesce(sum(skipped_manually),              0) as manually,
      coalesce(sum(skipped_category_filter),       0) as category_filter,
      coalesce(sum(skipped_classification_failed), 0) as classification_failed
    from public.analytics_events
    where app_source = 'tpc-extension'
      and event_type = 'catalog_batch'
      and created_at >= p_from
      and created_at <= p_to
      and (cardinality(p_users)    = 0 or user_email        = any(p_users))
      and (cardinality(p_versions) = 0 or extension_version = any(p_versions))
  )
  select v.reason, v.count::bigint
  from totals t,
  lateral (values
    ('no_photos',              t.no_photos),
    ('fields_filled',          t.fields_filled),
    ('manually',               t.manually),
    ('category_filter',        t.category_filter),
    ('classification_failed',  t.classification_failed)
  ) as v(reason, count);
$$;

grant execute on function public.get_skip_reasons(
  timestamptz, timestamptz, text[], text[]
) to authenticated;
