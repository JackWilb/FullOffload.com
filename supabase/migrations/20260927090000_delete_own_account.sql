-- Self-service account deletion. A signed-in user calls rpc('delete_own_account') and their
-- auth.users row is deleted; their submissions go with it (submissions.user_id cascades).
-- Devices they added stay: they carry no owner and other people's results may use them.
--
-- security definer is required because only the table owner can delete from auth.users. The
-- function takes no arguments and only ever deletes auth.uid(), so a caller can only delete
-- themselves.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Sign in to delete your account.' using errcode = '42501';
  end if;
  delete from auth.users where id = caller;
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user''s account and, by cascade, all of their submissions.';

revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;
