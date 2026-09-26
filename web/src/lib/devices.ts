// Device names, search and matching. Pure functions over the device list, so the picker filters
// on the client and the tests run without a database.
import type { Tables } from "./database.types";

export type Device = Tables<"devices">;
export type DeviceAlias = Tables<"device_aliases">;

/**
 * Mirror of public.normalize_device_name in SQL (the source of truth; see its migration for the
 * rules). Both are tested against fixtures/device-names.json.
 */
export function normalizeDeviceName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([a-z]{2,})([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/\b([0-9]+) (gb|gib)\b/g, "$1gb")
    .replace(/\b(nvidia|geforce|amd|radeon|apple|vram)\b/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/** URL slug for a device: "rtx 4090" -> "rtx-4090". Normalized names never contain hyphens. */
export function deviceSlug(device: Pick<Device, "normalized_name">): string {
  return device.normalized_name.replace(/ /g, "-");
}

/**
 * The device a slug points to. Falls back to aliases, so links to a device that was merged into
 * another one keep working.
 */
export function findDeviceBySlug(
  devices: Device[],
  aliases: DeviceAlias[],
  slug: string,
): Device | undefined {
  return findDeviceByNormalizedName(devices, aliases, slug.replace(/-/g, " "));
}

/** The existing device a typed name resolves to, by exact normalized name or alias. */
export function findExactDevice(
  devices: Device[],
  aliases: DeviceAlias[],
  name: string,
): Device | undefined {
  return findDeviceByNormalizedName(
    devices,
    aliases,
    normalizeDeviceName(name),
  );
}

function findDeviceByNormalizedName(
  devices: Device[],
  aliases: DeviceAlias[],
  normalized: string,
): Device | undefined {
  if (!normalized) return undefined;
  const direct = devices.find(
    (device) => device.normalized_name === normalized,
  );
  if (direct) return direct;
  const alias = aliases.find((a) => a.normalized_alias === normalized);
  return alias
    ? devices.find((device) => device.id === alias.device_id)
    : undefined;
}

const byName = (a: Device, b: Device) =>
  a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });

/**
 * Devices whose name (or vendor) contains every word of the query as a word prefix, so
 * "m3 max" lists every M3 Max variant and "4090" finds the RTX 4090. Exact matches come first,
 * then curated devices.
 */
export function searchDevices(devices: Device[], query: string): Device[] {
  const words = normalizeDeviceName(query).split(" ").filter(Boolean);
  const vendorWords = query.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length === 0 && vendorWords.length === 0)
    return [...devices].sort(byName);

  const normalized = words.join(" ");
  return devices
    .filter((device) => {
      const deviceWords = device.normalized_name.split(" ");
      const vendor = device.vendor?.toLowerCase() ?? "";
      const nameMatches = words.every((word) =>
        deviceWords.some((dw) => dw.startsWith(word)),
      );
      // A bare vendor query ("nvidia", "apple") normalizes to nothing; match it on the vendor.
      const vendorMatches =
        words.length > 0 || vendorWords.some((word) => vendor.startsWith(word));
      return nameMatches && vendorMatches;
    })
    .sort((a, b) => {
      const exact =
        Number(b.normalized_name === normalized) -
        Number(a.normalized_name === normalized);
      if (exact !== 0) return exact;
      if (a.status !== b.status) return a.status === "curated" ? -1 : 1;
      return byName(a, b);
    });
}

/**
 * Close existing matches for a name that has no exact match, shown before someone adds a new
 * device: devices sharing the name's model number, or at least two words.
 */
export function suggestSimilarDevices(
  devices: Device[],
  name: string,
  limit = 3,
): Device[] {
  const words = new Set(normalizeDeviceName(name).split(" ").filter(Boolean));
  if (words.size === 0) return [];

  return devices
    .map((device) => {
      const shared = device.normalized_name
        .split(" ")
        .filter((word) => words.has(word));
      const sharesNumber = shared.some((word) => /\d/.test(word));
      return {
        device,
        score: shared.length + (sharesNumber ? 1 : 0),
        sharesNumber,
      };
    })
    .filter(({ score, sharesNumber }) => sharesNumber || score >= 2)
    .sort((a, b) => b.score - a.score || byName(a.device, b.device))
    .slice(0, limit)
    .map(({ device }) => device);
}
