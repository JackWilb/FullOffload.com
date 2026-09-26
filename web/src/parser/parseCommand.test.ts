import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonicalQuant,
  parseCommand,
  type ParsedCommand,
} from "./parseCommand";

// The fixtures are the spec: one JSON file per command, { input, expected }.
const fixturesDir = new URL("../../../fixtures/commands/", import.meta.url);

type Fixture = { input: string; expected: ParsedCommand };

const fixtures = readdirSync(fixturesDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => ({
    file,
    fixture: JSON.parse(
      readFileSync(new URL(file, fixturesDir), "utf8"),
    ) as Fixture,
  }));

describe("parseCommand", () => {
  it("has fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)("$file", ({ fixture }) => {
    expect(parseCommand(fixture.input)).toEqual(fixture.expected);
  });

  it("emits canonical lowercase strings", () => {
    for (const { fixture } of fixtures) {
      const { runtime, model, quant } = parseCommand(fixture.input);
      for (const value of [runtime, model, quant]) {
        if (value !== null) expect(value).toBe(value.toLowerCase().trim());
      }
    }
  });
});

describe("canonicalQuant", () => {
  it.each([
    ["Q4_K_M", "q4_k_m"],
    ["q4_K_M", "q4_k_m"],
    ["q4-k-m", "q4_k_m"],
    ["Q4KM", "q4_k_m"],
    ["IQ4_XS", "iq4_xs"],
    ["Q8_0", "q8_0"],
    ["BF16", "bf16"],
    ["AWQ", "awq"],
    ["4bit-DWQ", "4bit_dwq"],
    ["  ", null],
  ])("%s -> %s", (input, expected) => {
    expect(canonicalQuant(input)).toBe(expected);
  });
});
