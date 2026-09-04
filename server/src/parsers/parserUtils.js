/**
 * Shared helpers for the Form 700 XLSX parsers (Schedules A, A-2, B, C/D/E and
 * the cover page).
 *
 * Every parser is PURE: it accepts a Buffer (or an already-read SheetJS
 * workbook), never touches the database and never throws — bad input yields
 * `null` / `[]` so the upload route can decide how to respond.
 */
import * as XLSX from "xlsx";

/** Read a workbook from a Buffer, file path or pass through a workbook object. */
export function loadWorkbook(input) {
  try {
    if (!input) return null;

    if (Buffer.isBuffer(input)) {
      return XLSX.read(input, { type: "buffer" });
    }

    if (input instanceof Uint8Array) {
      return XLSX.read(Buffer.from(input), { type: "buffer" });
    }

    if (typeof input === "string") {
      return XLSX.readFile(input);
    }

    // Already-parsed workbook (e.g. the upload route reads it once and shares it).
    if (typeof input === "object" && Array.isArray(input.SheetNames) && input.Sheets) {
      return input;
    }

    return null;
  } catch {
    return null;
  }
}

export function normalizeCellValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return String(value).trim();
}

/** `null` instead of "" for empty cells — used for nullable DB columns. */
export function cleanText(value) {
  const text = normalizeCellValue(value);
  return text === "" ? null : text;
}

/** "hello  WORLD" → "Hello World". Returns null for empty input. */
export function toTitleCase(value) {
  const text = cleanText(value);
  if (!text) return null;

  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeHeader(value) {
  return normalizeCellValue(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/$()-]/g, "")
    .trim();
}

/** Find the first sheet whose name contains any keyword (case-insensitive). */
export function findSheetName(workbook, keywords = [], { exclude = [] } = {}) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return null;
  }

  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const loweredExclude = exclude.map((keyword) => keyword.toLowerCase());

  const matched = workbook.SheetNames.find((sheetName) => {
    const lowered = normalizeHeader(sheetName);
    if (loweredExclude.some((keyword) => lowered.includes(keyword))) return false;
    return loweredKeywords.some((keyword) => lowered.includes(keyword));
  });

  return matched ?? null;
}

export function findSheetByName(workbook, keywords = [], options = {}) {
  const name = findSheetName(workbook, keywords, options);
  return name ? workbook.Sheets[name] : null;
}

/** Sheet → array of arrays (no header inference). */
export function sheetToRows(sheet) {
  if (!sheet) return [];
  try {
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  } catch {
    return [];
  }
}

/**
 * Locate the header row: the first row (within `maxScan`) containing a cell
 * whose normalized text starts with one of `keywords`. Real Form 700 exports put
 * section titles ("1. Business Entity or Trust…") above the column headers, so
 * the header is not always row 0.
 */
export function findHeaderRowIndex(sheet, keywords = [], maxScan = 15) {
  const rows = sheetToRows(sheet);
  const normalizedKeywords = keywords.map(normalizeHeader);

  for (let i = 0; i < Math.min(rows.length, maxScan); i += 1) {
    const cells = (rows[i] ?? []).map(normalizeHeader);
    const hit = cells.some((cell) =>
      cell !== "" && normalizedKeywords.some((keyword) => cell.startsWith(keyword)),
    );
    if (hit) return i;
  }

  return -1;
}

/** Sheet → array of objects keyed by the header row at `headerRowIndex`. */
export function sheetToObjects(sheet, headerRowIndex = 0) {
  if (!sheet || headerRowIndex < 0) {
    return [];
  }

  try {
    return XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
      range: headerRowIndex,
    });
  } catch {
    return [];
  }
}

/**
 * Read a cell by header name. Headers in the FPPC exports carry line breaks and
 * hints ("FAIR MARKET VALUE\r\n(Select from drop down list)"), so we first try
 * an exact normalized match and then fall back to a prefix match, preserving
 * column order so the left-most matching column wins. Pass `{ exact: true }`
 * for short generic labels ("Name") that would otherwise prefix-match unrelated
 * columns ("NAME OF BUSINESS ENTITY").
 */
export function getField(row, possibleKeys = [], { exact = false } = {}) {
  if (!row || typeof row !== "object") return "";

  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    normalizeHeader(key),
    value,
  ]);

  for (const possibleKey of possibleKeys) {
    const normalizedPossibleKey = normalizeHeader(possibleKey);
    if (!normalizedPossibleKey) continue;

    const exact = normalizedEntries.find(([key]) => key === normalizedPossibleKey);
    if (exact) {
      return normalizeCellValue(exact[1]);
    }
  }

  if (exact) return "";

  for (const possibleKey of possibleKeys) {
    const normalizedPossibleKey = normalizeHeader(possibleKey);
    if (!normalizedPossibleKey) continue;

    const prefixed = normalizedEntries.find(([key]) => key.startsWith(normalizedPossibleKey));
    if (prefixed) {
      return normalizeCellValue(prefixed[1]);
    }
  }

  return "";
}

export function isMeaningfulRow(values = []) {
  return values.some((value) => normalizeCellValue(value) !== "");
}

/**
 * Generic "find the sheet, find the header row, return row objects" helper used
 * by every schedule parser.
 * @param {Buffer|object} input buffer or workbook
 * @param {string[]} sheetKeywords sheet-name keywords (see findSheetName)
 * @param {string[]} headerKeywords header-cell keywords (see findHeaderRowIndex)
 * @param {{ exclude?: string[] }} options
 */
export function readScheduleRows(input, sheetKeywords, headerKeywords, options = {}) {
  const workbook = loadWorkbook(input);
  if (!workbook) return [];

  const sheet = findSheetByName(workbook, sheetKeywords, options);
  if (!sheet) return [];

  const headerRowIndex = findHeaderRowIndex(sheet, headerKeywords);
  if (headerRowIndex < 0) return [];

  return sheetToObjects(sheet, headerRowIndex).filter(
    (row) => row && typeof row === "object",
  );
}
