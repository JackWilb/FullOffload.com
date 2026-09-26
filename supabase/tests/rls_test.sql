-- Row-level security and grants, exercised the way PostgREST does it: as the anon and
-- authenticated roles, with the JWT claims set per request.
begin;
select plan(32);

-- Fixtures (as the table owner, which bypasses RLS). Isolated from seed data.
truncate public.submissions, public.device_aliases, public.devices;

insert into auth.users (id, email) values
  ('a11ce000-0000-4000-8000-00000000a11c', 'alice@example.com'),
  ('b0b00000-0000-4000-8000-000000000b0b', 'bob@example.com')
on conflict (id) do nothing;

insert into public.devices (name, vendor, vram_gb, memory_bandwidth_gbps, status)
values ('Test GPU 9000', 'NVIDIA', 24, 1000, 'curated');

insert into public.device_aliases (normalized_alias, device_id)
select 'Test GPU 9000 24 GB', id from public.devices;

insert into public.submissions (
  user_id, device_id, device_count, raw_command, runtime, model, quant, gen_tok_s, prompt_tok_s
)
select u.id, d.id, 1, 'llama-bench -m m.gguf', 'llama.cpp', 'm', 'q4_k_m', 100, 1000
from public.devices d
cross join (values
  ('a11ce000-0000-4000-8000-00000000a11c'::uuid),
  ('b0b00000-0000-4000-8000-000000000b0b'::uuid)
) as u (id);

-- ---------------------------------------------------------------------------------------------
-- anon: reads everything public, writes nothing.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select isnt_empty($$ select 1 from public.devices $$, 'anon can read devices');
select isnt_empty($$ select 1 from public.device_aliases $$, 'anon can read device_aliases');
select isnt_empty($$ select 1 from public.submissions $$, 'anon can read submissions');
select isnt_empty($$ select 1 from public.results_by_device $$, 'anon can read results_by_device');

select throws_ok(
  $$ insert into public.devices (name) values ('Anon GPU') $$,
  '42501', null, 'anon cannot add devices'
);
select throws_ok(
  $$ update public.devices set name = 'Renamed' $$,
  '42501', null, 'anon cannot update devices'
);
select throws_ok(
  $$ delete from public.devices $$,
  '42501', null, 'anon cannot delete devices'
);
select throws_ok(
  $$ insert into public.device_aliases (normalized_alias, device_id)
     select 'anon alias', id from public.devices $$,
  '42501', null, 'anon cannot add aliases'
);
select throws_ok(
  $$ insert into public.submissions (device_id, device_count, raw_command, runtime, model,
       gen_tok_s, prompt_tok_s)
     select id, 1, 'x', 'llama.cpp', 'm', 1, 1 from public.devices $$,
  '42501', null, 'anon cannot insert submissions'
);
select throws_ok(
  $$ update public.submissions set gen_tok_s = 1 $$,
  '42501', null, 'anon cannot update submissions'
);
select throws_ok(
  $$ delete from public.submissions $$,
  '42501', null, 'anon cannot delete submissions'
);

-- ---------------------------------------------------------------------------------------------
-- authenticated as Alice.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub": "a11ce000-0000-4000-8000-00000000a11c", "role": "authenticated"}';

select isnt_empty($$ select 1 from public.devices $$, 'users can read devices');
select isnt_empty($$ select 1 from public.device_aliases $$, 'users can read device_aliases');
select is(
  (select count(*)::integer from public.submissions), 2,
  'users can read every submission, not just their own'
);
select isnt_empty($$ select 1 from public.results_by_device $$, 'users can read results_by_device');

select lives_ok(
  $$ insert into public.submissions (device_id, device_count, raw_command, runtime, model,
       gen_tok_s, prompt_tok_s)
     select id, 1, 'ollama run m', 'ollama', 'm', 50, 500 from public.devices $$,
  'users can insert a submission; user_id defaults to their own id'
);
select is(
  (select user_id from public.submissions where runtime = 'ollama'),
  'a11ce000-0000-4000-8000-00000000a11c'::uuid,
  'the new submission belongs to the signed-in user'
);
select throws_ok(
  $$ insert into public.submissions (user_id, device_id, device_count, raw_command, runtime,
       model, gen_tok_s, prompt_tok_s)
     select 'b0b00000-0000-4000-8000-000000000b0b', id, 1, 'x', 'vllm', 'm', 1, 1
     from public.devices $$,
  '42501', null, 'users cannot insert a submission as someone else'
);
select throws_ok(
  $$ insert into public.submissions (device_id, device_count, raw_command, runtime, model,
       gen_tok_s, prompt_tok_s, created_at)
     select id, 1, 'x', 'vllm', 'm', 1, 1, now() - interval '1 day' from public.devices $$,
  '42501', null, 'users cannot backdate created_at'
);
select throws_ok(
  $$ update public.submissions set gen_tok_s = 999
     where user_id = 'a11ce000-0000-4000-8000-00000000a11c' $$,
  '42501', null, 'users cannot edit submissions, even their own'
);

select lives_ok(
  $$ delete from public.submissions
     where user_id = 'b0b00000-0000-4000-8000-000000000b0b' $$,
  'a delete aimed at another user''s submission runs'
);
select is(
  (select count(*)::integer from public.submissions
   where user_id = 'b0b00000-0000-4000-8000-000000000b0b'),
  1,
  '...but deletes nothing: other users'' submissions are untouchable'
);
select lives_ok(
  $$ delete from public.submissions where runtime = 'ollama' $$,
  'users can delete their own submission'
);
select is_empty(
  $$ select 1 from public.submissions where runtime = 'ollama' $$,
  'their own submission is gone'
);

select lives_ok(
  $$ insert into public.devices (name) values ('Brand New GPU') $$,
  'users can add a device by name'
);
select is(
  (select status::text from public.devices where name = 'Brand New GPU'),
  'user_added',
  'an added device is saved as user_added'
);
select throws_ok(
  $$ insert into public.devices (name, status) values ('Fake Curated GPU', 'curated') $$,
  '42501', null, 'users cannot add curated devices'
);
select throws_ok(
  $$ insert into public.devices (name, vram_gb, memory_bandwidth_gbps)
     values ('Spec GPU', 80, 3000) $$,
  '42501', null, 'users cannot set device specs'
);
select throws_ok(
  $$ update public.devices set vram_gb = 99 $$,
  '42501', null, 'users cannot update devices'
);
select throws_ok(
  $$ delete from public.devices where name = 'Brand New GPU' $$,
  '42501', null, 'users cannot delete devices, even ones they added'
);
select throws_ok(
  $$ insert into public.device_aliases (normalized_alias, device_id)
     select 'user alias', id from public.devices where name = 'Test GPU 9000' $$,
  '42501', null, 'users cannot add aliases'
);

-- ---------------------------------------------------------------------------------------------
-- Back as the owner: Bob's row survived Alice's delete.
reset role;

select is(
  (select count(*)::integer from public.submissions
   where user_id = 'b0b00000-0000-4000-8000-000000000b0b'),
  1,
  'the other user''s submission still exists'
);

select * from finish();
rollback;
