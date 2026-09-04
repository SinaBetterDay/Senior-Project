/**
 * Form 700 cover page → filer metadata.
 *
 * `parseCoverPage(buffer)` returns
 *   { filer_name, agency, district, office_title, filing_year }
 * with `null` for anything that cannot be found. It never throws.
 *
 * Detection order:
 *   1. A sheet whose name contains "cover" (the FPPC "Cover Page"). Two layouts
 *      are supported: a header row + data row table (Last Name / First Name /
 *      Agency / Position / Filing Year) or a label → value grid ("Name:" in one
 *      cell, the value in the next non-empty cell to the right or directly below).
 *   2. Fallback: NetFile-style bulk exports have no cover sheet but repeat the
 *      filer columns (Last Name, First Name, Middle Name, Agency, Position,
 *      Filing Year) on every schedule sheet — the first populated data row of the
 *      first schedule sheet is used.
 */
import {
  cleanText,
  findHeaderRowIndex,
  findSheetName,
  getField,
  loadWorkbook,
  normalizeHeader,
  sheetToObjects,
  sheetToRows,
} from "./parserUtils.js";

export const EMPTY_COVER_PAGE = Object.freeze({
  filer_name: null,
  agency: null,
  district: null,
  office_title: null,
  filing_year: null,
});

const LAST_NAME_KEYS = ["Last Name", "LAST NAME", "Filer Last Name"];
const FIRST_NAME_KEYS = ["First Name", "FIRST NAME", "Filer First Name"];
const MIDDLE_NAME_KEYS = ["Middle Name", "MIDDLE NAME", "Middle Initial"];
const FULL_NAME_KEYS = ["Filer Name", "FILER NAME", "Name of Filer", "NAME OF FILER", "Name", "NAME"];
const AGENCY_KEYS = ["Agency", "AGENCY", "Agency Name", "NAME OF AGENCY"];
const DISTRICT_KEYS = [
  "District",
  "DISTRICT",
  "Division, Board, Department, District, if applicable",
  "Division/Board/District",
  "Division",
];
const OFFICE_KEYS = ["Position", "POSITION", "Office", "Office Title", "Title", "Your Position", "YOUR POSITION"];
const YEAR_KEYS = ["Filing Year", "FILING YEAR", "Year", "YEAR", "Period Covered", "Annual Statement Year"];

function parseYear(value) {
  const text = cleanText(value);
  if (!text) return null;

  // Accept "2019", "2019.0", "01/01/2019 - 12/31/2019", "FY 2019"…
  const match = text.match(/(19|20)\d{2}/g);
  if (!match) return null;

  // For a period range take the last year mentioned (the statement year).
  return Number(match[match.length - 1]);
}

function composeName({ first, middle, last, full }) {
  const parts = [cleanText(first), cleanText(middle), cleanText(last)].filter(Boolean);
  if (cleanText(first) || cleanText(last)) return parts.join(" ");

  return cleanText(full);
}

function nameFieldsFromRow(row) {
  return {
    first: getField(row, FIRST_NAME_KEYS),
    middle: getField(row, MIDDLE_NAME_KEYS),
    last: getField(row, LAST_NAME_KEYS),
    // Exact match only: "Name" must not prefix-match "NAME OF BUSINESS ENTITY".
    full: getField(row, FULL_NAME_KEYS, { exact: true }),
  };
}

function isEmptyResult(result) {
  return Object.values(result).every((value) => value === null);
}

/** Header row + data row layout (also what the schedule sheets look like). */
function extractFromTable(sheet) {
  const headerRowIndex = findHeaderRowIndex(sheet, ["last name", "first name", "filer name", "name of filer"]);
  if (headerRowIndex < 0) return null;

  const rows = sheetToObjects(sheet, headerRowIndex);
  const dataRow = rows.find((row) => Boolean(composeName(nameFieldsFromRow(row))));
  if (!dataRow) return null;

  return {
    filer_name: composeName(nameFieldsFromRow(dataRow)),
    agency: cleanText(getField(dataRow, AGENCY_KEYS, { exact: true })),
    district: cleanText(getField(dataRow, DISTRICT_KEYS)),
    office_title: cleanText(getField(dataRow, OFFICE_KEYS, { exact: true })),
    filing_year: parseYear(getField(dataRow, YEAR_KEYS)),
  };
}

/** Label → value grid layout ("Agency:" | "County of Sonoma"). */
function extractFromLabels(sheet) {
  const rows = sheetToRows(sheet);
  if (rows.length === 0) return null;

  const labelSets = {
    last: LAST_NAME_KEYS,
    first: FIRST_NAME_KEYS,
    middle: MIDDLE_NAME_KEYS,
    full: FULL_NAME_KEYS,
    agency: AGENCY_KEYS,
    district: DISTRICT_KEYS,
    office: OFFICE_KEYS,
    year: YEAR_KEYS,
  };
  const normalizedSets = Object.fromEntries(
    Object.entries(labelSets).map(([key, labels]) => [key, labels.map(normalizeHeader)]),
  );

  const found = {};

  const valueFor = (rowIndex, colIndex) => {
    const row = rows[rowIndex] ?? [];
    for (let c = colIndex + 1; c < row.length; c += 1) {
      const text = cleanText(row[c]);
      if (text) return text;
    }
    const below = rows[rowIndex + 1]?.[colIndex];
    return cleanText(below);
  };

  rows.forEach((row, rowIndex) => {
    (row ?? []).forEach((cell, colIndex) => {
      const label = normalizeHeader(cell).replace(/:$/, "").trim();
      if (!label) return;

      for (const [key, labels] of Object.entries(normalizedSets)) {
        if (found[key] !== undefined) continue;
        if (labels.includes(label)) {
          const value = valueFor(rowIndex, colIndex);
          if (value !== null && value !== undefined) found[key] = value;
        }
      }
    });
  });

  const result = {
    filer_name: composeName(found),
    agency: cleanText(found.agency),
    district: cleanText(found.district),
    office_title: cleanText(found.office),
    filing_year: parseYear(found.year),
  };

  return isEmptyResult(result) ? null : result;
}

function extractFromSheet(sheet) {
  if (!sheet) return null;
  return extractFromTable(sheet) ?? extractFromLabels(sheet);
}

export function parseCoverPage(input) {
  try {
    const workbook = loadWorkbook(input);
    if (!workbook) return { ...EMPTY_COVER_PAGE };

    const coverSheetName = findSheetName(workbook, ["cover"]);
    if (coverSheetName) {
      const fromCover = extractFromSheet(workbook.Sheets[coverSheetName]);
      if (fromCover) return { ...EMPTY_COVER_PAGE, ...fromCover };
    }

    // Fallback: filer columns repeated on schedule sheets.
    for (const sheetName of workbook.SheetNames) {
      if (sheetName === coverSheetName) continue;
      const fromSchedule = extractFromTable(workbook.Sheets[sheetName]);
      if (fromSchedule) return { ...EMPTY_COVER_PAGE, ...fromSchedule };
    }

    return { ...EMPTY_COVER_PAGE };
  } catch {
    return { ...EMPTY_COVER_PAGE };
  }
}

export default parseCoverPage;
