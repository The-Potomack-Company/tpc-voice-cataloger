-- Reusable trigger function for auto-updating updated_at columns.
-- Source pattern: TPC App migration style.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
