-- Add classifier metadata for CRM v0.5 poller hash-skip support.
--
-- Phase 03 stores metadata.body_hash on each classification so subsequent
-- polls can avoid re-classifying unchanged Gmail thread bodies.

alter table public.crm_classifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists crm_classifications_metadata_body_hash_idx
  on public.crm_classifications ((metadata ->> 'body_hash'))
  where is_current = true;
