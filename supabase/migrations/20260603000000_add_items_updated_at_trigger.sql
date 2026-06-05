-- Phase 39 optimistic-locking: add items.updated_at version token + auto-bump trigger.
-- Reuses public.set_updated_at() from 20260421000000 (attach only — do NOT redefine; D-01: set_updated_at, not moddatetime).
-- Additive change. RLS on public.items is intentionally left undisturbed (Security V4). Claude-owned (D-046).

alter table public.items
  add column updated_at timestamptz not null default now();

update public.items
  set updated_at = coalesce(created_at, now());

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();
