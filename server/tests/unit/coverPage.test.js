import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { parseCoverPage, EMPTY_COVER_PAGE } from "../../src/parsers/coverPage.js";

const validBuffer = fs.readFileSync(path.resolve("tests/fixtures/form700-valid.xlsx"));
const malformedBuffer = fs.readFileSync(path.resolve("tests/fixtures/form700-malformed.xlsx"));

const COVER_KEYS = ["filer_name", "agency", "district", "office_title", "filing_year"].sort();

function bufferFromSheets(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("parseCoverPage", () => {
  it("reads a label/value 'Cover Page' sheet", () => {
    const buffer = bufferFromSheets({
      "Cover Page": [
        ["FORM 700 — STATEMENT OF ECONOMIC INTERESTS"],
        ["Name:", "Jane Q. Public"],
        ["Agency:", "City of Sacramento"],
        ["Division, Board, Department, District, if applicable", "District 4"],
        ["Position:", "Council Member"],
        ["Filing Year", 2025],
      ],
      "Schedule A": [["NAME OF BUSINESS ENTITY"], ["Acme"]],
    });

    const result = parseCoverPage(buffer);
    expect(Object.keys(result).sort()).toEqual(COVER_KEYS);
    expect(result).toEqual({
      filer_name: "Jane Q. Public",
      agency: "City of Sacramento",
      district: "District 4",
      office_title: "Council Member",
      filing_year: 2025,
    });
  });

  it("reads a header-row style cover sheet (sheet name only needs to contain 'cover')", () => {
    const buffer = bufferFromSheets({
      "cover": [
        ["Last Name", "First Name", "Middle Name", "Agency", "Position", "Filing Year"],
        ["Doe", "John", "", "County of Napa", "Supervisor", "2024"],
      ],
    });

    expect(parseCoverPage(buffer)).toEqual({
      filer_name: "John Doe",
      agency: "County of Napa",
      district: null,
      office_title: "Supervisor",
      filing_year: 2024,
    });
  });

  it("falls back to the filer columns on schedule sheets when there is no cover sheet (real export)", () => {
    const result = parseCoverPage(validBuffer);
    expect(result).toEqual({
      filer_name: "James M Gore",
      agency: "County of Sonoma",
      district: null,
      office_title: "Supervisor",
      filing_year: 2019,
    });
  });

  it("extracts the statement year from a period range", () => {
    const buffer = bufferFromSheets({
      "Cover Page": [
        ["Name", "Sam Filer"],
        ["Period Covered", "01/01/2023 - 12/31/2023"],
      ],
    });
    expect(parseCoverPage(buffer).filing_year).toBe(2023);
  });

  it("returns all-null fields when nothing recognizable is present", () => {
    const buffer = bufferFromSheets({ Sheet1: [["a", "b"], [1, 2]] });
    expect(parseCoverPage(buffer)).toEqual({ ...EMPTY_COVER_PAGE });
  });

  it("returns all-null fields (never throws) for null / unreadable / malformed input", () => {
    expect(parseCoverPage(null)).toEqual({ ...EMPTY_COVER_PAGE });
    expect(parseCoverPage(undefined)).toEqual({ ...EMPTY_COVER_PAGE });
    expect(parseCoverPage(Buffer.from("garbage"))).toEqual({ ...EMPTY_COVER_PAGE });
    expect(parseCoverPage(malformedBuffer)).toEqual({ ...EMPTY_COVER_PAGE });
  });
});
