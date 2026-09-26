-- results_by_device: medians, typical context size and grouping.
begin;
select plan(3);

truncate public.submissions, public.device_aliases, public.devices;

insert into auth.users (id, email)
values ('a11ce000-0000-4000-8000-00000000a11c', 'alice@example.com')
on conflict (id) do nothing;

insert into public.devices (name, vendor, vram_gb, memory_bandwidth_gbps, status)
values ('Test GPU 9000', 'NVIDIA', 24, 1000, 'curated');

insert into public.submissions (
  user_id, device_id, device_count, raw_command, runtime, model, quant, context_size,
  gen_tok_s, prompt_tok_s
)
select 'a11ce000-0000-4000-8000-00000000a11c', d.id, v.device_count, 'cmd', v.runtime, v.model,
  v.quant, v.context_size, v.gen, v.prompt
from public.devices d
cross join (values
  -- One card, odd count: median is the middle value; 8192 is the most common context size.
  (1, 'llama.cpp', 'qwen3-8b', 'q4_k_m', 8192,  100.0, 1000.0),
  (1, 'llama.cpp', 'qwen3-8b', 'q4_k_m', 8192,  130.0, 3000.0),
  (1, 'llama.cpp', 'qwen3-8b', 'q4_k_m', 32768, 110.0, 2000.0),
  -- Two cards, same runtime, model and quant: its own row, never blended into the single card.
  (2, 'llama.cpp', 'qwen3-8b', 'q4_k_m', null,  200.0, 5000.0),
  -- Even count: median interpolates; no context size reported.
  (1, 'ollama', 'qwen3-8b', null, null, 60.0, 400.0),
  (1, 'ollama', 'qwen3-8b', null, null, 70.0, 600.0)
) as v (device_count, runtime, model, quant, context_size, gen, prompt);

select results_eq(
  $$ select device_count, runtime, model, quant, median_gen_tok_s, median_prompt_tok_s,
       typical_context_size, submission_count
     from public.results_by_device
     order by runtime, device_count $$,
  $$ values
     (1::smallint, 'llama.cpp', 'qwen3-8b', 'q4_k_m', 110::double precision,
       2000::double precision, 8192, 3),
     (2::smallint, 'llama.cpp', 'qwen3-8b', 'q4_k_m', 200::double precision,
       5000::double precision, null::integer, 1),
     (1::smallint, 'ollama', 'qwen3-8b', null::text, 65::double precision,
       500::double precision, null::integer, 2) $$,
  'one row per device count, runtime, model and quant, with medians and the most common context'
);

select is(
  (select count(distinct device_id)::integer from public.results_by_device), 1,
  'rows carry the device id'
);

-- The view follows the caller's grants (security_invoker): anon sees the same rows.
set local role anon;
select is(
  (select count(*)::integer from public.results_by_device), 3,
  'anon reads the same aggregated rows'
);
reset role;

select * from finish();
rollback;
