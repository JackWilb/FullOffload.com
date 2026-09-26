-- Rate limit: at most 20 submissions per user per rolling hour
-- (public.submissions_enforce_rate_limit). Update the numbers here if the limit changes.
begin;
select plan(5);

truncate public.submissions, public.device_aliases, public.devices;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

insert into public.devices (name, vendor, vram_gb, memory_bandwidth_gbps, status)
values ('Test GPU 9000', 'NVIDIA', 24, 1000, 'curated');

create function pg_temp.submit_as(user_id uuid, n integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  for i in 1..n loop
    insert into public.submissions (device_id, device_count, raw_command, runtime, model,
      gen_tok_s, prompt_tok_s)
    select id, 1, 'llama-bench -m m.gguf', 'llama.cpp', 'm', 10 + i, 100 from public.devices;
  end loop;
end;
$$;
grant execute on function pg_temp.submit_as(uuid, integer) to authenticated;

set local role authenticated;

select lives_ok(
  $$ select pg_temp.submit_as('11111111-1111-1111-1111-111111111111', 20) $$,
  'a user can submit 20 results in an hour'
);
select throws_ok(
  $$ select pg_temp.submit_as('11111111-1111-1111-1111-111111111111', 1) $$,
  'PT429',
  'Rate limit reached: at most 20 submissions per hour. Try again later.',
  'the 21st submission in an hour is rejected'
);
select lives_ok(
  $$ select pg_temp.submit_as('22222222-2222-2222-2222-222222222222', 1) $$,
  'the limit is per user'
);

-- An hour later the earlier submissions no longer count.
reset role;
update public.submissions set created_at = now() - interval '61 minutes'
where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;

select lives_ok(
  $$ select pg_temp.submit_as('11111111-1111-1111-1111-111111111111', 1) $$,
  'submissions older than an hour do not count'
);

reset role;
select is(
  (select count(*)::integer from public.submissions
   where user_id = '11111111-1111-1111-1111-111111111111'),
  21,
  'only the rejected submission is missing'
);

select * from finish();
rollback;
