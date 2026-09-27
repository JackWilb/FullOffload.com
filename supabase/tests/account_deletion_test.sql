-- Self-service account deletion: a user can delete only themselves, and their results go too.
begin;
select plan(7);

truncate public.submissions, public.device_aliases, public.devices;

insert into auth.users (id, email) values
  ('a11ce000-0000-4000-8000-00000000a11c', 'alice@example.com'),
  ('b0b00000-0000-4000-8000-000000000b0b', 'bob@example.com')
on conflict (id) do nothing;

insert into public.devices (name, vendor, vram_gb, memory_bandwidth_gbps, status)
values ('Test GPU 9000', 'NVIDIA', 24, 1000, 'curated');

insert into public.submissions (
  user_id, device_id, device_count, raw_command, runtime, model, gen_tok_s, prompt_tok_s
)
select u.id, d.id, 1, 'cmd', 'llama.cpp', 'm', 100, 1000
from public.devices d
cross join (values
  ('a11ce000-0000-4000-8000-00000000a11c'::uuid),
  ('b0b00000-0000-4000-8000-000000000b0b'::uuid)
) as u (id);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$ select public.delete_own_account() $$,
  '42501', null, 'anon cannot call delete_own_account'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a11ce000-0000-4000-8000-00000000a11c", "role": "authenticated"}';
select lives_ok(
  $$ select public.delete_own_account() $$,
  'a signed-in user can delete their own account'
);

reset role;
select is_empty(
  $$ select 1 from auth.users where id = 'a11ce000-0000-4000-8000-00000000a11c' $$,
  'the account is gone'
);
select is_empty(
  $$ select 1 from public.submissions where user_id = 'a11ce000-0000-4000-8000-00000000a11c' $$,
  'their submissions are gone'
);
select isnt_empty(
  $$ select 1 from auth.users where id = 'b0b00000-0000-4000-8000-000000000b0b' $$,
  'other accounts are untouched'
);
select isnt_empty(
  $$ select 1 from public.submissions where user_id = 'b0b00000-0000-4000-8000-000000000b0b' $$,
  'other users'' submissions are untouched'
);
select isnt_empty(
  $$ select 1 from public.devices where name = 'Test GPU 9000' $$,
  'devices stay'
);

select * from finish();
rollback;
