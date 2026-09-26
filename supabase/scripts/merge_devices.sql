-- Device merge script. Folds duplicate devices into their canonical device.
--
-- Run it with psql against any database; the default is a dry run that changes nothing.
--
--   1. List likely duplicates (dry run, read-only):
--        psql "$DATABASE_URL" -f supabase/scripts/merge_devices.sql
--
--   2. Preview specific merges, as duplicate_id:canonical_id pairs (runs in a transaction and
--      rolls it back):
--        psql "$DATABASE_URL" -v merges='12:3,15:4' -f supabase/scripts/merge_devices.sql
--
--   3. Apply them:
--        psql "$DATABASE_URL" -v merges='12:3,15:4' -v apply=1 -f supabase/scripts/merge_devices.sql
--
-- Merging a duplicate into its canonical device repoints the duplicate's submissions and aliases
-- to the canonical device, deletes the duplicate, and saves its name as an alias, so the next
-- person who types that name lands on the canonical device.
--
-- Locally, DATABASE_URL is postgresql://postgres:postgres@127.0.0.1:54322/postgres. For prod, use
-- the session pooler connection string from the Supabase dashboard (Connect > Session pooler).
-- The script runs as the postgres role; it needs no service role key.

\set ON_ERROR_STOP on

\if :{?merges}

begin;

create temp table merge_pairs (
  duplicate_id bigint primary key,
  canonical_id bigint not null
) on commit drop;

insert into merge_pairs (duplicate_id, canonical_id)
select split_part(pair, ':', 1)::bigint, split_part(pair, ':', 2)::bigint
from unnest(string_to_array(replace(:'merges', ' ', ''), ',')) as pair;

do $$
declare
  problem text;
begin
  select string_agg(format('%s:%s', m.duplicate_id, m.canonical_id), ', ') into problem
  from merge_pairs m
  where m.duplicate_id = m.canonical_id
     or not exists (select 1 from public.devices d where d.id = m.duplicate_id)
     or not exists (select 1 from public.devices d where d.id = m.canonical_id)
     or m.canonical_id in (select duplicate_id from merge_pairs);
  if problem is not null then
    raise exception 'Invalid pairs: %. Each pair needs two different existing devices, and a canonical device cannot also be merged away.', problem;
  end if;
end;
$$;

\echo 'Merges:'
select
  m.duplicate_id,
  dup.name as duplicate_name,
  dup.status as duplicate_status,
  (select count(*) from public.submissions s where s.device_id = m.duplicate_id) as submissions_moved,
  m.canonical_id,
  canon.name as canonical_name,
  canon.status as canonical_status
from merge_pairs m
join public.devices dup on dup.id = m.duplicate_id
join public.devices canon on canon.id = m.canonical_id
order by m.duplicate_id;

update public.submissions s
set device_id = m.canonical_id
from merge_pairs m
where s.device_id = m.duplicate_id;

update public.device_aliases a
set device_id = m.canonical_id
from merge_pairs m
where a.device_id = m.duplicate_id;

create temp table merged_names on commit drop as
with deleted as (
  delete from public.devices d
  using merge_pairs m
  where d.id = m.duplicate_id
  returning d.name, m.canonical_id
)
select name, canonical_id from deleted;

-- device_aliases normalizes the name on write.
insert into public.device_aliases (normalized_alias, device_id)
select name, canonical_id from merged_names
on conflict (normalized_alias) do nothing;

\if :{?apply}
commit;
\echo 'Applied.'
\else
rollback;
\echo 'Dry run: rolled back. Add -v apply=1 to apply these merges.'
\endif

\else

-- Dry run: list likely duplicates. Candidates for each user-added device are other devices whose
-- normalized name
--   * is the same once spaces are removed ("rtx 4090" and "rtx4090 ..."),
--   * has the same words in another order ("4090 rtx"),
--   * is a prefix of it ("rtx 4090" for "rtx 4090 founders edition"), or
--   * starts with it ("rtx 3060 12gb" for "rtx 3060").
-- These are heuristics: review each proposal before merging.
\echo 'Likely duplicates (dry run, nothing changed):'
with dup as (
  select d.*, (select count(*) from public.submissions s where s.device_id = d.id) as n
  from public.devices d
  where d.status = 'user_added'
),
candidate as (
  select c.*, (select count(*) from public.submissions s where s.device_id = c.id) as n
  from public.devices c
),
proposal as (
  select
    dup.id as duplicate_id,
    dup.name as duplicate_name,
    dup.n as duplicate_submissions,
    candidate.id as canonical_id,
    candidate.name as canonical_name,
    candidate.status as canonical_status,
    candidate.n as canonical_submissions,
    case
      when replace(dup.normalized_name, ' ', '') = replace(candidate.normalized_name, ' ', '')
        then 'same without spaces'
      when (select array_agg(w order by w) from unnest(string_to_array(dup.normalized_name, ' ')) w)
         = (select array_agg(w order by w) from unnest(string_to_array(candidate.normalized_name, ' ')) w)
        then 'same words'
      when dup.normalized_name like candidate.normalized_name || ' %'
        then 'duplicate adds words'
      else 'duplicate is shorter'
    end as reason
  from dup
  join candidate
    on candidate.id <> dup.id
   and (
     replace(dup.normalized_name, ' ', '') = replace(candidate.normalized_name, ' ', '')
     or (select array_agg(w order by w) from unnest(string_to_array(dup.normalized_name, ' ')) w)
      = (select array_agg(w order by w) from unnest(string_to_array(candidate.normalized_name, ' ')) w)
     or dup.normalized_name like candidate.normalized_name || ' %'
     or candidate.normalized_name like dup.normalized_name || ' %'
   )
)
select
  duplicate_id,
  duplicate_name,
  duplicate_submissions,
  canonical_id,
  canonical_name,
  canonical_status,
  canonical_submissions,
  reason,
  format('%s:%s', duplicate_id, canonical_id) as merge_pair
from proposal
order by duplicate_id, canonical_status, canonical_submissions desc, canonical_id;

\echo 'To preview merges: psql "$DATABASE_URL" -v merges=''<duplicate_id>:<canonical_id>,...'' -f supabase/scripts/merge_devices.sql'

\endif
