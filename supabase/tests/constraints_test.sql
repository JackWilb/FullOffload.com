-- Check constraints reject bad input, submitted the way a signed-in user would.
begin;
select plan(26);

truncate public.submissions, public.device_aliases, public.devices;

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'alice@example.com');

insert into public.devices (name, vendor, vram_gb, memory_bandwidth_gbps, status)
values ('Test GPU 9000', 'NVIDIA', 24, 1000, 'curated');

set local role authenticated;
set local request.jwt.claims =
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Inserts one submission, overriding a single column with a raw SQL expression.
create function pg_temp.submit(col text, val text) returns void language plpgsql as $$
declare
  cols text[] := array['device_count', 'raw_command', 'runtime', 'model', 'quant',
                       'context_size', 'gen_tok_s', 'prompt_tok_s'];
  vals text[] := array['1', '''llama-bench -m m.gguf''', '''llama.cpp''', '''qwen3-8b''',
                       '''q4_k_m''', '8192', '42.5', '1200'];
begin
  vals[array_position(cols, col)] := val;
  execute format(
    'insert into public.submissions (device_id, %s) select id, %s from public.devices',
    array_to_string(cols, ', '), array_to_string(vals, ', ')
  );
end;
$$;

-- Speeds: greater than 0, at most 100,000.
select throws_ok($$ select pg_temp.submit('gen_tok_s', '0') $$, '23514', null, 'gen_tok_s = 0 is rejected');
select throws_ok($$ select pg_temp.submit('gen_tok_s', '-5') $$, '23514', null, 'negative gen_tok_s is rejected');
select throws_ok($$ select pg_temp.submit('gen_tok_s', '100000.1') $$, '23514', null, 'gen_tok_s above 100,000 is rejected');
select throws_ok($$ select pg_temp.submit('gen_tok_s', 'null') $$, '23502', null, 'gen_tok_s is required');
select throws_ok($$ select pg_temp.submit('prompt_tok_s', '0') $$, '23514', null, 'prompt_tok_s = 0 is rejected');
select throws_ok($$ select pg_temp.submit('prompt_tok_s', '100001') $$, '23514', null, 'prompt_tok_s above 100,000 is rejected');
select throws_ok($$ select pg_temp.submit('prompt_tok_s', 'null') $$, '23502', null, 'prompt_tok_s is required');

-- Device count: 1 to 16.
select throws_ok($$ select pg_temp.submit('device_count', '0') $$, '23514', null, 'device_count = 0 is rejected');
select throws_ok($$ select pg_temp.submit('device_count', '17') $$, '23514', null, 'device_count = 17 is rejected');

-- Context size: optional, 1 to 10,000,000.
select throws_ok($$ select pg_temp.submit('context_size', '0') $$, '23514', null, 'context_size = 0 is rejected');
select throws_ok($$ select pg_temp.submit('context_size', '10000001') $$, '23514', null, 'context_size above 10,000,000 is rejected');

-- Runtime and model: required, non-empty, canonical lowercase.
select throws_ok($$ select pg_temp.submit('runtime', '''''') $$, '23514', null, 'empty runtime is rejected');
select throws_ok($$ select pg_temp.submit('runtime', 'null') $$, '23502', null, 'runtime is required');
select throws_ok($$ select pg_temp.submit('runtime', '''Llama.cpp''') $$, '23514', null, 'non-lowercase runtime is rejected');
select throws_ok($$ select pg_temp.submit('runtime', ''' ollama''') $$, '23514', null, 'untrimmed runtime is rejected');
select throws_ok($$ select pg_temp.submit('model', '''''') $$, '23514', null, 'empty model is rejected');
select throws_ok($$ select pg_temp.submit('model', 'null') $$, '23502', null, 'model is required');
select throws_ok($$ select pg_temp.submit('model', '''Qwen3-8B''') $$, '23514', null, 'non-lowercase model is rejected');

-- Quant: optional, but canonical when present.
select throws_ok($$ select pg_temp.submit('quant', '''Q4_K_M''') $$, '23514', null, 'non-lowercase quant is rejected');
select throws_ok($$ select pg_temp.submit('quant', '''''') $$, '23514', null, 'empty quant is rejected');

-- Command: required and non-blank.
select throws_ok($$ select pg_temp.submit('raw_command', '''   ''') $$, '23514', null, 'blank command is rejected');
select throws_ok($$ select pg_temp.submit('raw_command', 'repeat(''x'', 4001)') $$, '23514', null, 'command over 4,000 characters is rejected');

-- Boundaries and optional fields are accepted.
select lives_ok($$ select pg_temp.submit('gen_tok_s', '100000') $$, 'gen_tok_s = 100,000 is accepted');
select lives_ok($$ select pg_temp.submit('device_count', '16') $$, 'device_count = 16 is accepted');
select lives_ok($$ select pg_temp.submit('context_size', '10000000') $$, 'context_size = 10,000,000 is accepted');
select lives_ok($$ select pg_temp.submit('quant', 'null') $$, 'quant and context size may be left empty');

select * from finish();
rollback;
