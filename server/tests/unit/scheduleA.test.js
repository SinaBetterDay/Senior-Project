import { describe, it, expect } from "vitest";
import path from "path";
import { parseScheduleA } from "../../src/parsers/scheduleA.js";

describe("parseScheduleA", () => {
  it("returns parsed Schedule A rows for a valid XLSX with data", () => {
    const filePath = path.resolve("tests/fixtures/form700-valid.xlsx");
    const result = parseScheduleA(filePath);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    expect(result[0]).toHaveProperty("entityName");
    expect(result[0]).toHaveProperty("fairMarketValue");
    expect(result[0]).toHaveProperty("natureOfInvestment");
  });

  it("returns an empty array for invalid input", () => {
    const result = parseScheduleA("fake.xlsx");
    expect(result).toEqual([]);
  });
});