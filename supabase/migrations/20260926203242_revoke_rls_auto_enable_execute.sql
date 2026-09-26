-- Supabase's "automatic RLS" setting installs public.rls_auto_enable(), an event-trigger function
-- that PUBLIC can execute by default. It can't do anything when called through the API, but the
-- security advisor flags it, and nothing but its event trigger should run it. Event triggers
-- don't check EXECUTE, so automatic RLS keeps working. The function only exists on the hosted
-- project, so this is a no-op locally.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
