import type { Device } from "./devices";

// Number formatting from the design system: speeds get one decimal below 1,000 and none at or
// above it, with thousands separators; context sizes read as 8k, 32k, 128k.

const oneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatSpeed(tokensPerSecond: number): string {
  return tokensPerSecond < 1000
    ? oneDecimal.format(tokensPerSecond)
    : whole.format(tokensPerSecond);
}

export function formatContext(tokens: number): string {
  for (const [unit, size] of [
    ["M", 1_048_576],
    ["M", 1_000_000],
    ["k", 1_024],
    ["k", 1_000],
  ] as const) {
    if (tokens >= size && tokens % size === 0)
      return `${whole.format(tokens / size)}${unit}`;
  }
  return whole.format(tokens);
}

export function formatCount(count: number): string {
  return whole.format(count);
}

export function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

/** "RTX 4090" for one card, "2× RTX 4090" for a multi-GPU rig. */
export function deviceCountLabel(
  deviceCount: number,
  deviceName: string,
): string {
  return deviceCount > 1 ? `${deviceCount}× ${deviceName}` : deviceName;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "24 GB" for a GPU, "128 GB" for unified memory; null for unverified devices. */
export function deviceMemoryLabel(
  device: Pick<Device, "vram_gb">,
): string | null {
  return device.vram_gb === null ? null : `${formatCount(device.vram_gb)} GB`;
}

export function deviceBandwidthLabel(
  device: Pick<Device, "memory_bandwidth_gbps">,
): string | null {
  return device.memory_bandwidth_gbps === null
    ? null
    : `${formatCount(device.memory_bandwidth_gbps)} GB/s`;
}
