alter table public.item_drafts
  add column if not exists page_content_key text,
  add column if not exists page_segment_index integer;

create unique index if not exists item_drafts_page_content_segment_key
  on public.item_drafts (session_id, page_content_key, page_segment_index);
