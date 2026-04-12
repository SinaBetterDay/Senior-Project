import { describe, it, expect } from "vitest";
import path from "path";
import { parseScheduleB } from "../../src/parsers/scheduleB.js";

describe("parseScheduleB", () => {
  it("returns parsed Schedule B rows for a valid XLSX with data", () => {
    const filePath = path.resolve("tests/fixtures/form700-valid.xlsx");
    const result = parseScheduleB(filePath);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    expect(result[0]).toHaveProperty("propertyDescription");
    expect(result[0]).toHaveProperty("city");
    expect(result[0]).toHaveProperty("county");
    expect(result[0]).toHaveProperty("fairMarketValue");
  });

  it("returns an empty array for invalid input", () => {
    const result = parseScheduleB("fake.xlsx");
    expect(result).toEqual([]);
  });
});