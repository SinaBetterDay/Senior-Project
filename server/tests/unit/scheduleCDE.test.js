import { describe, it, expect } from "vitest";
import path from "path";
import { parseScheduleCDE } from "../../src/parsers/scheduleCDE.js";

describe("parseScheduleCDE", () => {
  it("returns parsed Schedule C/D/E rows for a valid XLSX with data", () => {
    const filePath = path.resolve("tests/fixtures/form700-valid.xlsx");
    const result = parseScheduleCDE(filePath);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    expect(result[0]).toHaveProperty("sourceName");
    expect(result[0]).toHaveProperty("amount");
    expect(result[0]).toHaveProperty("scheduleType");
  });

  it("returns an empty array for invalid input", () => {
    const result = parseScheduleCDE("fake.xlsx");
    expect(result).toEqual([]);
  });

  it("returns an empty array for malformed XLSX input", () => {
  const result = parseScheduleCDE("tests/fixtures/form700-malformed.xlsx");
  expect(result).toEqual([]);
});

});