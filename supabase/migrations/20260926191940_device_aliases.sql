-- Device aliases: other names that resolve to an existing device, for example the name of a
-- duplicate that the merge script folded into its canonical device, or "RTX 4090 24 GB".

create table public.device_aliases (
  normalized_alias text primary key,
  device_id bigint not null references public.devices (id) on delete cascade,

  constraint device_aliases_normalized_alias_not_empty check (normalized_alias <> '')
);

create index device_aliases_device_id_idx on public.device_aliases (device_id);

comment on table public.device_aliases is
  'Alternative device names. Written only by seed.sql and the merge script; values are normalized on write.';

-- Whatever is written to normalized_alias is run through normalize_device_name, so the seed and
-- the merge script can insert display names ("GeForce RTX 4090 24GB").
create function public.device_aliases_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.normalized_alias := public.normalize_device_name(new.normalized_alias);
  return new;
end;
$$;

create trigger device_aliases_normalize
  before insert or update of normalized_alias on public.device_aliases
  for each row execute function public.device_aliases_normalize();

-- Device matching: a new device whose name matches an alias is the aliased device, so reject it
-- the same way the unique index rejects an exact name match. The client then selects the
-- existing device.
create function public.devices_reject_alias_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.device_aliases
    where normalized_alias = public.normalize_device_name(new.name)
  ) then
    raise exception 'A device named "%" already exists under another name.', new.name
      using errcode = 'unique_violation',
            constraint = 'devices_normalized_name_key';
  end if;
  return new;
end;
$$;

create trigger devices_reject_alias_match
  before insert or update of name on public.devices
  for each row execute function public.devices_reject_alias_match();

revoke all on function public.device_aliases_normalize() from public, anon, authenticated;
revoke all on function public.devices_reject_alias_match() from public, anon, authenticated;

-- Grants: read-only for everyone. No client writes.
alter table public.device_aliases enable row level security;
revoke all on table public.device_aliases from anon, authenticated;
grant select on table public.device_aliases to anon, authenticated;

create policy "Device aliases are readable by everyone"
  on public.device_aliases for select
  to anon, authenticated
  using (true);
