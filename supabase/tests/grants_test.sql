-- Grants and RLS audit. Every table, view and function in the public schema is listed here with
-- the exact privileges anon and authenticated hold on it. A new object fails this file until its
-- grants are reviewed and added below.
begin;
select plan(33);

-- ---------------------------------------------------------------------------------------------
-- Inventory: nothing in public escapes this audit.
select tables_are('public', array['devices', 'device_aliases', 'submissions']);
select views_are('public', array['results_by_device']);
select functions_are('public', array[
  'normalize_device_name',
  'device_aliases_normalize',
  'devices_reject_alias_match',
  'submissions_enforce_rate_limit'
]);

-- ---------------------------------------------------------------------------------------------
-- RLS is on for every table, and every view runs with the caller's privileges.
select is_empty(
  $$ select relname from pg_class
     where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relrowsecurity $$,
  'every table in public has RLS enabled'
);
select is_empty(
  $$ select relname from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'v'
       and not coalesce(reloptions @> array['security_invoker=true'], false) $$,
  'every view in public is security_invoker'
);

-- ---------------------------------------------------------------------------------------------
-- Table-level privileges.
select table_privs_are('public', 'devices', 'anon', array['SELECT']);
select table_privs_are('public', 'devices', 'authenticated', array['SELECT']);
select table_privs_are('public', 'device_aliases', 'anon', array['SELECT']);
select table_privs_are('public', 'device_aliases', 'authenticated', array['SELECT']);
select table_privs_are('public', 'submissions', 'anon', array['SELECT']);
select table_privs_are('public', 'submissions', 'authenticated', array['SELECT', 'DELETE']);
select table_privs_are('public', 'results_by_device', 'anon', array['SELECT']);
select table_privs_are('public', 'results_by_device', 'authenticated', array['SELECT']);

-- Column-level insert privileges: users add devices by name only, and can't set a submission's
-- id or created_at.
select column_privs_are('public', 'devices', 'name', 'authenticated', array['SELECT', 'INSERT']);
select column_privs_are('public', 'devices', 'status', 'authenticated', array['SELECT']);
select column_privs_are('public', 'devices', 'vram_gb', 'authenticated', array['SELECT']);
select column_privs_are('public', 'submissions', 'user_id', 'authenticated', array['SELECT', 'INSERT']);
select column_privs_are('public', 'submissions', 'gen_tok_s', 'authenticated', array['SELECT', 'INSERT']);
select column_privs_are('public', 'submissions', 'created_at', 'authenticated', array['SELECT']);
select column_privs_are('public', 'submissions', 'id', 'authenticated', array['SELECT']);

-- ---------------------------------------------------------------------------------------------
-- Functions: none callable by anon; only the normalization function (used when a signed-in user
-- adds a device) callable by authenticated.
select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any function in public'
);
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and has_function_privilege('authenticated', p.oid, 'execute')),
  array['normalize_device_name'],
  'authenticated can execute only normalize_device_name'
);

-- ---------------------------------------------------------------------------------------------
-- Policies: exactly the ones the architecture calls for.
select policies_are('public', 'devices', array[
  'Devices are readable by everyone',
  'Signed-in users can add unverified devices'
]);
select policies_are('public', 'device_aliases', array[
  'Device aliases are readable by everyone'
]);
select policies_are('public', 'submissions', array[
  'Submissions are readable by everyone',
  'Users insert submissions as themselves',
  'Users delete their own submissions'
]);
select policy_cmd_is('public', 'devices', 'Signed-in users can add unverified devices', 'INSERT', 'Signed-in users can add unverified devices: INSERT only');
select policy_roles_are('public', 'devices', 'Signed-in users can add unverified devices', array['authenticated']);
select policy_cmd_is('public', 'submissions', 'Users insert submissions as themselves', 'INSERT', 'Users insert submissions as themselves: INSERT only');
select policy_roles_are('public', 'submissions', 'Users insert submissions as themselves', array['authenticated']);
select policy_cmd_is('public', 'submissions', 'Users delete their own submissions', 'DELETE', 'Users delete their own submissions: DELETE only');
select policy_roles_are('public', 'submissions', 'Users delete their own submissions', array['authenticated']);

-- ---------------------------------------------------------------------------------------------
-- Auto-expose is off: a table or view created without grants is unreachable.
create table public.audit_ungranted (id integer);
create view public.audit_ungranted_view with (security_invoker = true) as select 1 as one;

set local role anon;
select throws_ok(
  $$ select * from public.audit_ungranted $$,
  '42501', null, 'a table without grants is unreachable for anon'
);
select throws_ok(
  $$ select * from public.audit_ungranted_view $$,
  '42501', null, 'a view without grants is unreachable for anon'
);
reset role;

select * from finish();
rollback;
