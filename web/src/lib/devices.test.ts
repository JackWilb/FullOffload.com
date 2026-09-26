import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Device,
  type DeviceAlias,
  deviceSlug,
  findDeviceBySlug,
  findExactDevice,
  normalizeDeviceName,
  searchDevices,
  suggestSimilarDevices,
} from "./devices";

type NameCase = { input: string; expected: string };

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/device-names.json", import.meta.url),
    "utf8",
  ),
) as NameCase[];

describe("normalizeDeviceName", () => {
  it.each(fixture)("$input -> '$expected'", ({ input, expected }) => {
    expect(normalizeDeviceName(input)).toBe(expected);
  });

  it("is idempotent", () => {
    for (const { input } of fixture) {
      const once = normalizeDeviceName(input);
      expect(normalizeDeviceName(once)).toBe(once);
    }
  });

  it("is tested against the same cases as the SQL function", () => {
    // supabase/tests/device_names_test.sql embeds a verbatim copy of the fixture between
    // $fixture$ markers; keep the two in sync.
    const sql = readFileSync(
      new URL("../../../supabase/tests/device_names_test.sql", import.meta.url),
      "utf8",
    );
    const embedded =
      /\$fixture\$([\s\S]*?)\$fixture\$/.exec(sql)?.[1] ?? "null";
    expect(JSON.parse(embedded)).toEqual(fixture);
  });
});

let nextId = 1;
function device(name: string, overrides: Partial<Device> = {}): Device {
  return {
    id: nextId++,
    name,
    normalized_name: normalizeDeviceName(name),
    vendor: null,
    vram_gb: null,
    memory_bandwidth_gbps: null,
    unified_memory: false,
    status: "curated",
    ...overrides,
  };
}

const devices = [
  device("RTX 4090", { vendor: "NVIDIA", vram_gb: 24 }),
  device("RTX 4060 Ti 16 GB", { vendor: "NVIDIA" }),
  device("RTX 4060 Ti 8 GB", { vendor: "NVIDIA" }),
  device("RTX 5090", { vendor: "NVIDIA" }),
  device("RTX 5080", { vendor: "NVIDIA" }),
  device("Apple M3 Max (30-core GPU, 36 GB)", {
    vendor: "Apple",
    unified_memory: true,
  }),
  device("Apple M3 Max (40-core GPU, 128 GB)", {
    vendor: "Apple",
    unified_memory: true,
  }),
  device("Apple M3 Pro (18 GB)", { vendor: "Apple", unified_memory: true }),
  device("RX 7900 XTX", { vendor: "AMD" }),
  device("RTX 4090 Laptop", { status: "user_added" }),
];
const [rtx4090] = devices;
const aliases: DeviceAlias[] = [
  { normalized_alias: "rtx 4090 24gb", device_id: rtx4090?.id ?? 0 },
  { normalized_alias: "4090 rtx", device_id: rtx4090?.id ?? 0 },
];

describe("searchDevices", () => {
  const names = (query: string) =>
    searchDevices(devices, query).map((d) => d.name);

  it("lists every memory variant of a family", () => {
    expect(names("m3 max")).toEqual([
      "Apple M3 Max (30-core GPU, 36 GB)",
      "Apple M3 Max (40-core GPU, 128 GB)",
    ]);
  });

  it("matches model numbers and ignores vendor words", () => {
    expect(names("nvidia geforce 4090")).toEqual([
      "RTX 4090",
      "RTX 4090 Laptop",
    ]);
    expect(names("rtx4060ti")).toEqual([
      "RTX 4060 Ti 8 GB",
      "RTX 4060 Ti 16 GB",
    ]);
  });

  it("puts the exact match first", () => {
    expect(names("rtx 4090")[0]).toBe("RTX 4090");
  });

  it("finds a vendor's devices by vendor name", () => {
    expect(names("apple")).toHaveLength(3);
    expect(names("amd")).toEqual(["RX 7900 XTX"]);
  });
});

describe("exact matching", () => {
  it("resolves names and aliases to the existing device", () => {
    expect(
      findExactDevice(devices, aliases, "NVIDIA GeForce RTX 4090")?.name,
    ).toBe("RTX 4090");
    expect(findExactDevice(devices, aliases, "RTX 4090 24GB")?.name).toBe(
      "RTX 4090",
    );
    expect(findExactDevice(devices, aliases, "RTX 5090 D")).toBeUndefined();
  });

  it("round-trips slugs, including slugs of merged devices", () => {
    expect(rtx4090 && deviceSlug(rtx4090)).toBe("rtx-4090");
    expect(findDeviceBySlug(devices, aliases, "rtx-4090")?.name).toBe(
      "RTX 4090",
    );
    expect(findDeviceBySlug(devices, aliases, "4090-rtx")?.name).toBe(
      "RTX 4090",
    );
    expect(
      findDeviceBySlug(devices, aliases, "m3-max-40-core-gpu-128gb")?.name,
    ).toBe("Apple M3 Max (40-core GPU, 128 GB)");
    expect(findDeviceBySlug(devices, aliases, "nope")).toBeUndefined();
  });
});

describe("suggestSimilarDevices", () => {
  it("suggests devices that share the model number", () => {
    const names = suggestSimilarDevices(devices, "RTX 5090 D").map(
      (d) => d.name,
    );
    expect(names[0]).toBe("RTX 5090");
  });

  it("suggests nothing for unrelated names", () => {
    expect(suggestSimilarDevices(devices, "Mystery Accelerator")).toEqual([]);
  });
});
