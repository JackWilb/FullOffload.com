import { describe, expect, it } from "vitest";
import type { Result } from "./api";
import { sortResults } from "./results";

function result(model: string, deviceCount: number, gen: number): Result {
  return {
    key: `${model}-${deviceCount}`,
    deviceCount,
    runtime: "llama.cpp",
    model,
    quant: "q4_k_m",
    medianGenTokS: gen,
    medianPromptTokS: 1000,
    typicalContextSize: 8192,
    submissionCount: 1,
    submissions: [],
  };
}

describe("sortResults", () => {
  const rows = [
    result("a", 2, 300),
    result("b", 1, 50),
    result("c", 4, 900),
    result("d", 1, 120),
  ];

  it("puts single-card rows first, then sorts within each device count", () => {
    const sorted = sortResults(rows, { key: "gen", direction: "desc" });
    expect(sorted.map((r) => r.key)).toEqual(["d-1", "b-1", "a-2", "c-4"]);
  });

  it("keeps single-card rows first when sorting ascending", () => {
    const sorted = sortResults(rows, { key: "model", direction: "asc" });
    expect(sorted.map((r) => r.deviceCount)).toEqual([1, 1, 2, 4]);
  });
});
