-- DAT-8: enforce receipt_number uniqueness within a session (collisions were
-- previously allowed). Resolve any pre-existing collisions non-destructively
-- first so the index can build: keep the receipt on the earliest item in each
-- colliding group (by created_at, then id) and clear it (set null) on the later
-- duplicates. Item content is preserved; only the duplicated receipt_number is
-- cleared and must be re-entered manually. Blank receipts ('') and nulls both
-- mean "no receipt" and are excluded from the uniqueness constraint.
with ranked as (
  select id,
         row_number() over (
           partition by session_id, receipt_number
           order by created_at, id
         ) as rn
  from public.items
  where receipt_number is not null and receipt_number <> ''
)
update public.items i
set receipt_number = null
from ranked r
where i.id = r.id and r.rn > 1;

create unique index if not exists items_session_receipt_unique
  on public.items (session_id, receipt_number)
  where receipt_number is not null and receipt_number <> '';
