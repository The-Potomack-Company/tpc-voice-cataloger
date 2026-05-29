-- DAT-8 scope change: receipt_number must be globally unique, not
-- per-session. The original DAT-8 migration (20260527000003) enforced
-- uniqueness only within a session, but auction workflow treats receipt
-- numbers as `<sale-code>-<lot>` identifiers that must never repeat
-- anywhere in the catalog. Cross-session duplicates were re-catalogs of
-- the same physical item by different specialists handing off mid-day.
--
-- Pre-flight + manual triage on 2026-05-28 suffixed 16 cross-session
-- duplicates with '-1' so this global unique index can build. Blank
-- receipts ('') and nulls remain excluded from the constraint.
--
-- The previous per-session index (items_session_receipt_unique) is
-- redundant once a global index exists; drop it to avoid double
-- enforcement and an extra btree on every receipt write.

drop index if exists public.items_session_receipt_unique;

create unique index if not exists items_receipt_unique
  on public.items (receipt_number)
  where receipt_number is not null and receipt_number <> '';
