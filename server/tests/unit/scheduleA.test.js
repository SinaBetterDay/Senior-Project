import { describe, it, expect } from "vitest";
import { parseScheduleA } from "../../src/parsers/scheduleA.js";

describe("parseScheduleA", () => {
  it("returns an empty array for invalid or missing input", () => {
    const result = parseScheduleA("tests/fixtures/does-not-exist.xlsx");
    expect(result).toEqual([]);
  });
});