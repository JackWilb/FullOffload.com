-- Curated devices, hand-checked against vendor spec pages.
--
-- Each distinct memory and bandwidth configuration is its own row. vram_gb is dedicated VRAM, or
-- the unified memory size where unified_memory is true. memory_bandwidth_gbps is the vendor's
-- peak memory bandwidth in GB/s.
--
-- Safe to re-run: rows are upserted on normalized_name, so editing a row here and re-running
-- updates it, and a user_added device with the same name is promoted to curated with its specs.
-- `pnpm db:reset` runs this locally; deploy.yml runs it on prod (`supabase db push --include-seed`).
--
-- Only add a device when you are sure of both numbers.

insert into public.devices (vendor, name, vram_gb, memory_bandwidth_gbps, unified_memory, status)
select vendor, name, vram_gb, memory_bandwidth_gbps, unified_memory, 'curated'
from (values
  -- NVIDIA GeForce RTX 50 series
  ('NVIDIA', 'RTX 5090',          32, 1792,  false),
  ('NVIDIA', 'RTX 5080',          16,  960,  false),
  ('NVIDIA', 'RTX 5070 Ti',       16,  896,  false),
  ('NVIDIA', 'RTX 5070',          12,  672,  false),
  ('NVIDIA', 'RTX 5060 Ti 16 GB', 16,  448,  false),
  ('NVIDIA', 'RTX 5060 Ti 8 GB',   8,  448,  false),
  ('NVIDIA', 'RTX 5060',           8,  448,  false),
  -- NVIDIA GeForce RTX 40 series
  ('NVIDIA', 'RTX 4090',          24, 1008,  false),
  ('NVIDIA', 'RTX 4080 SUPER',    16,  736,  false),
  ('NVIDIA', 'RTX 4080',          16,  716.8, false),
  ('NVIDIA', 'RTX 4070 Ti SUPER', 16,  672,  false),
  ('NVIDIA', 'RTX 4070 Ti',       12,  504,  false),
  ('NVIDIA', 'RTX 4070 SUPER',    12,  504,  false),
  ('NVIDIA', 'RTX 4070',          12,  504,  false),
  ('NVIDIA', 'RTX 4060 Ti 16 GB', 16,  288,  false),
  ('NVIDIA', 'RTX 4060 Ti 8 GB',   8,  288,  false),
  ('NVIDIA', 'RTX 4060',           8,  272,  false),
  -- NVIDIA GeForce RTX 30 series
  ('NVIDIA', 'RTX 3090 Ti',       24, 1008,  false),
  ('NVIDIA', 'RTX 3090',          24,  936,  false),
  ('NVIDIA', 'RTX 3080 Ti',       12,  912,  false),
  ('NVIDIA', 'RTX 3080 12 GB',    12,  912,  false),
  ('NVIDIA', 'RTX 3080 10 GB',    10,  760,  false),
  ('NVIDIA', 'RTX 3070 Ti',        8,  608,  false),
  ('NVIDIA', 'RTX 3070',           8,  448,  false),
  ('NVIDIA', 'RTX 3060 Ti',        8,  448,  false),
  ('NVIDIA', 'RTX 3060 12 GB',    12,  360,  false),
  ('NVIDIA', 'RTX 3060 8 GB',      8,  240,  false),
  -- NVIDIA workstation and desktop AI
  ('NVIDIA', 'RTX PRO 6000 Blackwell', 96, 1792, false),
  ('NVIDIA', 'RTX 6000 Ada',      48,  960,  false),
  ('NVIDIA', 'RTX A6000',         48,  768,  false),
  ('NVIDIA', 'DGX Spark',        128,  273,  true),

  -- AMD Radeon RX 9000 series
  ('AMD', 'RX 9070 XT',           16,  640,  false),
  ('AMD', 'RX 9070',              16,  640,  false),
  ('AMD', 'RX 9060 XT 16 GB',     16,  320,  false),
  ('AMD', 'RX 9060 XT 8 GB',       8,  320,  false),
  ('AMD', 'Radeon AI PRO R9700',  32,  640,  false),
  -- AMD Radeon RX 7000 series
  ('AMD', 'RX 7900 XTX',          24,  960,  false),
  ('AMD', 'RX 7900 XT',           20,  800,  false),
  ('AMD', 'RX 7900 GRE',          16,  576,  false),
  ('AMD', 'RX 7800 XT',           16,  624,  false),
  ('AMD', 'RX 7700 XT',           12,  432,  false),
  ('AMD', 'RX 7600 XT',           16,  288,  false),
  ('AMD', 'RX 7600',               8,  288,  false),
  ('AMD', 'Radeon PRO W7900',     48,  864,  false),
  -- AMD Radeon RX 6000 series
  ('AMD', 'RX 6950 XT',           16,  576,  false),
  ('AMD', 'RX 6900 XT',           16,  512,  false),
  ('AMD', 'RX 6800 XT',           16,  512,  false),
  ('AMD', 'RX 6800',              16,  512,  false),
  ('AMD', 'RX 6750 XT',           12,  432,  false),
  ('AMD', 'RX 6700 XT',           12,  384,  false),
  -- AMD Ryzen AI Max (Strix Halo), unified LPDDR5X-8000 on a 256-bit bus
  ('AMD', 'Ryzen AI Max+ 395 (128 GB)', 128, 256, true),
  ('AMD', 'Ryzen AI Max+ 395 (64 GB)',   64, 256, true),

  -- Apple M1 family
  ('Apple', 'Apple M1 (8 GB)',               8,   68.25, true),
  ('Apple', 'Apple M1 (16 GB)',             16,   68.25, true),
  ('Apple', 'Apple M1 Pro (16 GB)',         16,  200,   true),
  ('Apple', 'Apple M1 Pro (32 GB)',         32,  200,   true),
  ('Apple', 'Apple M1 Max (32 GB)',         32,  400,   true),
  ('Apple', 'Apple M1 Max (64 GB)',         64,  400,   true),
  ('Apple', 'Apple M1 Ultra (64 GB)',       64,  800,   true),
  ('Apple', 'Apple M1 Ultra (128 GB)',     128,  800,   true),
  -- Apple M2 family
  ('Apple', 'Apple M2 (8 GB)',               8,  100,   true),
  ('Apple', 'Apple M2 (16 GB)',             16,  100,   true),
  ('Apple', 'Apple M2 (24 GB)',             24,  100,   true),
  ('Apple', 'Apple M2 Pro (16 GB)',         16,  200,   true),
  ('Apple', 'Apple M2 Pro (32 GB)',         32,  200,   true),
  ('Apple', 'Apple M2 Max (32 GB)',         32,  400,   true),
  ('Apple', 'Apple M2 Max (64 GB)',         64,  400,   true),
  ('Apple', 'Apple M2 Max (96 GB)',         96,  400,   true),
  ('Apple', 'Apple M2 Ultra (64 GB)',       64,  800,   true),
  ('Apple', 'Apple M2 Ultra (128 GB)',     128,  800,   true),
  ('Apple', 'Apple M2 Ultra (192 GB)',     192,  800,   true),
  -- Apple M3 family (the M3 Max's bandwidth depends on its GPU core count)
  ('Apple', 'Apple M3 (8 GB)',               8,  100,   true),
  ('Apple', 'Apple M3 (16 GB)',             16,  100,   true),
  ('Apple', 'Apple M3 (24 GB)',             24,  100,   true),
  ('Apple', 'Apple M3 Pro (18 GB)',         18,  150,   true),
  ('Apple', 'Apple M3 Pro (36 GB)',         36,  150,   true),
  ('Apple', 'Apple M3 Max (30-core GPU, 36 GB)',   36, 300, true),
  ('Apple', 'Apple M3 Max (30-core GPU, 96 GB)',   96, 300, true),
  ('Apple', 'Apple M3 Max (40-core GPU, 48 GB)',   48, 400, true),
  ('Apple', 'Apple M3 Max (40-core GPU, 64 GB)',   64, 400, true),
  ('Apple', 'Apple M3 Max (40-core GPU, 128 GB)', 128, 400, true),
  ('Apple', 'Apple M3 Ultra (96 GB)',       96,  819,   true),
  ('Apple', 'Apple M3 Ultra (256 GB)',     256,  819,   true),
  ('Apple', 'Apple M3 Ultra (512 GB)',     512,  819,   true),
  -- Apple M4 family (the M4 Max's bandwidth depends on its GPU core count)
  ('Apple', 'Apple M4 (16 GB)',             16,  120,   true),
  ('Apple', 'Apple M4 (24 GB)',             24,  120,   true),
  ('Apple', 'Apple M4 (32 GB)',             32,  120,   true),
  ('Apple', 'Apple M4 Pro (24 GB)',         24,  273,   true),
  ('Apple', 'Apple M4 Pro (48 GB)',         48,  273,   true),
  ('Apple', 'Apple M4 Pro (64 GB)',         64,  273,   true),
  ('Apple', 'Apple M4 Max (32-core GPU, 36 GB)',   36, 410, true),
  ('Apple', 'Apple M4 Max (40-core GPU, 48 GB)',   48, 546, true),
  ('Apple', 'Apple M4 Max (40-core GPU, 64 GB)',   64, 546, true),
  ('Apple', 'Apple M4 Max (40-core GPU, 128 GB)', 128, 546, true),
  -- Apple M5
  ('Apple', 'Apple M5 (16 GB)',             16,  153,   true),
  ('Apple', 'Apple M5 (24 GB)',             24,  153,   true),
  ('Apple', 'Apple M5 (32 GB)',             32,  153,   true)
) as d (vendor, name, vram_gb, memory_bandwidth_gbps, unified_memory)
on conflict (normalized_name) do update set
  name = excluded.name,
  vendor = excluded.vendor,
  vram_gb = excluded.vram_gb,
  memory_bandwidth_gbps = excluded.memory_bandwidth_gbps,
  unified_memory = excluded.unified_memory,
  status = 'curated';

-- A curated GPU whose name has no memory size also answers to "<name> <VRAM> GB", so
-- "RTX 4090 24GB" resolves to "RTX 4090" (normalization keeps memory sizes; see the
-- normalize_device_name migration). Names that already carry a memory size are skipped.
insert into public.device_aliases (normalized_alias, device_id)
select d.name || ' ' || trim_scale(d.vram_gb) || ' GB', d.id
from public.devices d
where d.status = 'curated'
  and not d.unified_memory
  and d.normalized_name !~ '\m[0-9]+gb\M'
on conflict (normalized_alias) do nothing;
