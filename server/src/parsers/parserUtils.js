import * as XLSX from "xlsx";

export function loadWorkbook(input) {
  try {
    if (Buffer.isBuffer(input)) {
      return XLSX.read(input, { type: "buffer" });
    }

    if (typeof input === "string") {
      return XLSX.readFile(input);
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

export function normalizeHeader(value) {
  return normalizeCellValue(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/$()-]/g, "")
    .trim();
}

export function findSheetByName(workbook, keywords = []) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return null;
  }

  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());

  const matchedSheetName = workbook.SheetNames.find((sheetName) => {
    const loweredSheetName = sheetName.toLowerCase();
    return loweredKeywords.some((keyword) => loweredSheetName.includes(keyword));
  });

  return matchedSheetName ? workbook.Sheets[matchedSheetName] : null;
}

export function sheetToObjects(sheet) {
  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });
}

export function getField(row, possibleKeys = []) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    normalizeHeader(key),
    value,
  ]);

  for (const possibleKey of possibleKeys) {
    const normalizedPossibleKey = normalizeHeader(possibleKey);
    const matchedEntry = normalizedEntries.find(([key]) => key === normalizedPossibleKey);

    if (matchedEntry) {
      return normalizeCellValue(matchedEntry[1]);
    }
  }

  return "";
}

export function isMeaningfulRow(values = []) {
  return values.some((value) => normalizeCellValue(value) !== "");
}