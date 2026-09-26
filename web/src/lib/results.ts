import type { Result } from "./api";

export type SortKey =
  "gen" | "prompt" | "context" | "count" | "model" | "quant" | "runtime";
export type Sort = { key: SortKey; direction: "asc" | "desc" };

export const DEFAULT_SORT: Sort = { key: "gen", direction: "desc" };

/** Text columns start A to Z; number columns start highest first. */
export function defaultDirection(key: SortKey): Sort["direction"] {
  return key === "model" || key === "quant" || key === "runtime"
    ? "asc"
    : "desc";
}

function sortValue(result: Result, key: SortKey): number | string {
  switch (key) {
    case "gen":
      return result.medianGenTokS;
    case "prompt":
      return result.medianPromptTokS;
    case "context":
      return result.typicalContextSize ?? -1;
    case "count":
      return result.submissionCount;
    case "model":
      return result.model;
    case "quant":
      return result.quant ?? "";
    case "runtime":
      return result.runtime;
  }
}

/**
 * Single-card rows always come first, then rows for 2, 3, ... cards, each group ordered by the
 * chosen column. Multi-GPU results never interleave with single-card ones.
 */
export function sortResults(results: Result[], sort: Sort): Result[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...results].sort((a, b) => {
    if (a.deviceCount !== b.deviceCount) return a.deviceCount - b.deviceCount;
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "en", { numeric: true });
    return order * sign || b.medianGenTokS - a.medianGenTokS;
  });
}
