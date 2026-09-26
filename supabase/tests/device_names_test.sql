-- Device-name normalization and device matching.
begin;
select plan(9);

-- Isolate from seed data.
truncate public.submissions, public.device_aliases, public.devices;

-- A verbatim copy of fixtures/device-names.json. web/src/lib/devices.test.ts fails if the two
-- differ, so the SQL function and its TypeScript mirror are held to the same cases.
create temp table cases on commit drop as
select c ->> 'input' as input, c ->> 'expected' as expected
from jsonb_array_elements($fixture$
[
  { "input": "RTX 4090", "expected": "rtx 4090" },
  { "input": "NVIDIA GeForce RTX 4090", "expected": "rtx 4090" },
  { "input": "nvidia geforce rtx4090", "expected": "rtx 4090" },
  { "input": "RTX-4090", "expected": "rtx 4090" },
  { "input": "GeForce RTX 4090 24GB VRAM", "expected": "rtx 4090 24gb" },
  { "input": "RTX 4090 (24 GB)", "expected": "rtx 4090 24gb" },
  { "input": "RTX 4060 Ti 16 GB", "expected": "rtx 4060 ti 16gb" },
  { "input": "RTX 4060 Ti 16GB", "expected": "rtx 4060 ti 16gb" },
  { "input": "rtx 4060ti 16 gib", "expected": "rtx 4060 ti 16gb" },
  { "input": "RTX 4060 Ti 8 GB", "expected": "rtx 4060 ti 8gb" },
  { "input": "RTX 4070 Ti SUPER", "expected": "rtx 4070 ti super" },
  { "input": "RTX 5090 D", "expected": "rtx 5090 d" },
  { "input": "RTX 5090D", "expected": "rtx 5090 d" },
  { "input": "RTX A6000", "expected": "rtx a6000" },
  { "input": "RTX PRO 6000 Blackwell", "expected": "rtx pro 6000 blackwell" },
  { "input": "NVIDIA DGX Spark", "expected": "dgx spark" },
  { "input": "AMD Radeon RX 7900 XTX", "expected": "rx 7900 xtx" },
  { "input": "Radeon RX7900XTX", "expected": "rx 7900 xtx" },
  { "input": "RX 9070 XT", "expected": "rx 9070 xt" },
  { "input": "AMD Radeon PRO W7900", "expected": "pro w7900" },
  { "input": "AMD Ryzen AI Max+ 395 (128 GB)", "expected": "ryzen ai max 395 128gb" },
  { "input": "Apple M3 Max (40-core GPU, 128 GB)", "expected": "m3 max 40 core gpu 128gb" },
  { "input": "apple m3 max 40-core gpu 128gb", "expected": "m3 max 40 core gpu 128gb" },
  { "input": "M3Max 40c GPU 128GB", "expected": "m3 max 40 c gpu 128gb" },
  { "input": "Apple M2 Ultra (192 GB)", "expected": "m2 ultra 192gb" },
  { "input": "  Mac   Studio  ", "expected": "mac studio" },
  { "input": "NVIDIA", "expected": "" },
  { "input": "!!!", "expected": "" }
]
$fixture$::jsonb) as c;

select results_eq(
  $$ select input, public.normalize_device_name(input) from cases order by input $$,
  $$ select input, expected from cases order by input $$,
  'normalize_device_name matches every case in fixtures/device-names.json'
);

select is_empty(
  $$ select input from cases
     where public.normalize_device_name(public.normalize_device_name(input))
       <> public.normalize_device_name(input) $$,
  'normalize_device_name is idempotent'
);

insert into public.devices (name, vendor, vram_gb, memory_bandwidth_gbps, status)
values ('RTX 4090', 'NVIDIA', 24, 1008, 'curated');

select is(
  (select normalized_name from public.devices where name = 'RTX 4090'),
  'rtx 4090',
  'devices.normalized_name is generated from name'
);

select throws_ok(
  $$ insert into public.devices (name) values ('NVIDIA GeForce RTX 4090') $$,
  '23505', null,
  'a name that normalizes to an existing device is rejected, so the existing device is reused'
);

select throws_ok(
  $$ insert into public.devices (name) values ('NVIDIA') $$,
  '23514', null,
  'a name that normalizes to nothing is rejected'
);

insert into public.device_aliases (normalized_alias, device_id)
select 'GeForce RTX 4090 24GB VRAM', id from public.devices where name = 'RTX 4090';

select ok(
  exists (select 1 from public.device_aliases where normalized_alias = 'rtx 4090 24gb'),
  'device_aliases.normalized_alias is normalized on write'
);

select throws_ok(
  $$ insert into public.devices (name) values ('RTX 4090 24 GB') $$,
  '23505', null,
  'a name that matches an alias is rejected, so the aliased device is reused'
);

select throws_ok(
  $$ insert into public.device_aliases (normalized_alias, device_id)
     select 'rtx4090 (24gb)', id from public.devices where name = 'RTX 4090' $$,
  '23505', null,
  'aliases are unique after normalization'
);

select lives_ok(
  $$ insert into public.devices (name) values ('RTX 4090 D') $$,
  'a genuinely new name is accepted'
);

select * from finish();
rollback;
