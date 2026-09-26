-- Device-name normalization.
--
-- One function turns any spelling of a device name into a canonical key. It fills
-- devices.normalized_name (a generated column) and device_aliases.normalized_alias (a trigger),
-- so the unique index on normalized_name makes exact matches reuse the existing device:
-- "NVIDIA GeForce RTX 4090", "rtx4090" and "RTX-4090" all become "rtx 4090".
--
-- Steps, in order:
--   1. lowercase
--   2. strip punctuation (every run of non [a-z0-9] becomes one space)
--   3. split letter runs from digits ("rtx4090" -> "rtx 4090", "4070ti" -> "4070 ti"); a single
--      letter before digits stays joined, so "m3", "w7900" and "a6000" keep their shape
--   4. canonicalize memory sizes ("16 GB", "16GB", "16 GiB" -> "16gb") and drop the word "vram"
--   5. strip vendor and series words: nvidia, geforce, amd, radeon, apple
--   6. collapse whitespace
--
-- Memory sizes are canonicalized, not removed: "RTX 4060 Ti 8 GB" and "RTX 4060 Ti 16 GB" are
-- different devices (see docs/architecture.md, Data model). Curated devices without a memory size
-- in their name get a "<name> <vram> GB" alias in seed.sql instead.
--
-- The function is idempotent: normalize(normalize(x)) = normalize(x).
-- web/src/lib/devices.ts mirrors it for client-side search; both are tested against
-- fixtures/device-names.json. Change them together. Changing it later needs a migration that also
-- recomputes stored values (update public.devices set name = name, and re-normalize aliases).

create function public.normalize_device_name(raw text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(raw), '[^a-z0-9]+', ' ', 'g'),
              '([a-z]{2,})([0-9])', '\1 \2', 'g'),
            '([0-9])([a-z])', '\1 \2', 'g'),
          '\m([0-9]+) (gb|gib)\M', '\1gb', 'g'),
        '\m(nvidia|geforce|amd|radeon|apple|vram)\M', ' ', 'g'),
      ' +', ' ', 'g')
  );
$$;

comment on function public.normalize_device_name(text) is
  'Canonical device-name key used for devices.normalized_name and device_aliases.normalized_alias.';

-- Only signed-in users write rows that call it (adding a device). Anon reads stored values.
revoke all on function public.normalize_device_name(text) from public, anon, authenticated;
grant execute on function public.normalize_device_name(text) to authenticated;
