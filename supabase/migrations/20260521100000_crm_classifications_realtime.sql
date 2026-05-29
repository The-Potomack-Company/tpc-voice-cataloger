-- D-042 follow-up: enable Supabase Realtime on crm_classifications so the
-- dashboard CRM inbox can subscribe to INSERT events and refresh the table
-- live as the poller writes new rows. RLS is respected (admins-read policy
-- already in place) so only admins receive events.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crm_classifications'
  ) then
    alter publication supabase_realtime add table public.crm_classifications;
  end if;
end $$;
