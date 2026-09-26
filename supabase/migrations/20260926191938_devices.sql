-- Devices: the lookup table behind the device picker. Specs come from here, never from users.
-- Each distinct memory and bandwidth configuration is its own row, for example
-- "Apple M3 Max (40-core GPU, 128 GB)" and "RTX 4060 Ti 16 GB".

create type public.device_status as enum ('curated', 'user_added');

create table public.devices (
  id bigint generated always as identity primary key,
  name text not null,
  normalized_name text generated always as (public.normalize_device_name(name)) stored not null,
  vendor text,
  vram_gb numeric,
  memory_bandwidth_gbps numeric,
  unified_memory boolean not null default false,
  status public.device_status not null default 'user_added',

  constraint devices_normalized_name_key unique (normalized_name),
  constraint devices_name_trimmed check (name = btrim(name) and char_length(name) between 2 and 80),
  constraint devices_normalized_name_not_empty check (normalized_name <> ''),
  constraint devices_vendor_not_empty check (vendor <> ''),
  constraint devices_vram_gb_positive check (vram_gb > 0),
  constraint devices_memory_bandwidth_gbps_positive check (memory_bandwidth_gbps > 0),
  -- Curated rows carry full specs; user-added rows are name only until Jack adds specs.
  constraint devices_curated_has_specs check (
    status = 'user_added'
    or (vendor is not null and vram_gb is not null and memory_bandwidth_gbps is not null)
  )
);

comment on table public.devices is
  'Device lookup table. Curated rows come from supabase/seed.sql; user_added rows are unverified.';

-- Grants: everyone reads; signed-in users may add a device by name only. Every other column
-- takes its default (status user_added, no specs), and the policy below re-checks that.
alter table public.devices enable row level security;
revoke all on table public.devices from anon, authenticated;
grant select on table public.devices to anon, authenticated;
grant insert (name) on table public.devices to authenticated;

create policy "Devices are readable by everyone"
  on public.devices for select
  to anon, authenticated
  using (true);

create policy "Signed-in users can add unverified devices"
  on public.devices for insert
  to authenticated
  with check (
    status = 'user_added'
    and vendor is null
    and vram_gb is null
    and memory_bandwidth_gbps is null
    and unified_memory = false
  );
