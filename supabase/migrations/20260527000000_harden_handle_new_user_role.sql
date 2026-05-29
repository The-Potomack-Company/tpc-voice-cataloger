-- SEC-1: handle_new_user trusted raw_user_meta_data->>'role', allowing
-- self-assigned admin via supabase.auth.signUp({data:{role:'admin'}}) when
-- public signup is enabled. Hardcode 'specialist'; admin elevation stays
-- strictly on the admin-only Edge Function path. See _workspace/Urgent/
-- sec-role-escalation-signup.md and audit-consolidated-backlog-2026-05-27.md.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'User'),
    'specialist',
    true
  );
  return new;
end;
$$;
