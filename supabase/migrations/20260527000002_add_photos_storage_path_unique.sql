-- DAT-5: prevent duplicate photo metadata rows on upload retry.
-- The upload queue retried the metadata INSERT (storage upload is already
-- idempotent via upsert), producing duplicate public.photos rows for the same
-- storage_path. Enforce uniqueness so the client can upsert ON CONFLICT DO NOTHING.

-- Remove any pre-existing duplicates (keep one arbitrary row per storage_path)
-- first, otherwise the unique index cannot be built.
delete from public.photos p
using public.photos q
where p.storage_path = q.storage_path
  and p.ctid > q.ctid;

create unique index if not exists photos_storage_path_key
  on public.photos (storage_path);
