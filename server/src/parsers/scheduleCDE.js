import {
  getField,
  isMeaningfulRow,
  loadWorkbook,
  normalizeHeader,
  sheetToObjects,
} from "./parserUtils.js";

export function parseScheduleCDE(input) {
  const workbook = loadWorkbook(input);

  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return [];
  }

  const targetSheets = workbook.SheetNames.filter((sheetName) => {
    const normalizedName = normalizeHeader(sheetName);

    return (
      normalizedName.includes("schedule c") ||
      normalizedName.includes("schedule d") ||
      normalizedName.includes("schedule e") ||
      normalizedName === "c" ||
      normalizedName === "d" ||
      normalizedName === "e"
    );
  });

  if (targetSheets.length === 0) {
    return [];
  }

  const results = [];

  for (const sheetName of targetSheets) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      continue;
    }

    const normalizedSheetName = normalizeHeader(sheetName);

    let headerRowIndex = 0;
    if (normalizedSheetName.includes("schedule c")) {
      headerRowIndex = 1;
    } else if (normalizedSheetName.includes("schedule d")) {
      headerRowIndex = 0;
    } else if (normalizedSheetName.includes("schedule e")) {
      headerRowIndex = 0;
    }

    const jsonRows = sheetToObjects(sheet, headerRowIndex);

    for (const row of jsonRows) {
      const sourceName = getField(row, [
        "name of source",
        "source",
        "income source",
        "gift source",
        "travel source",
        "name",
      ]);

      const amount = getField(row, [
        "gross income received",
        "value",
        "amount",
        "amount/value",
      ]);

      const scheduleType = inferScheduleType(sheetName, row);

      if (!isMeaningfulRow([sourceName, amount])) {
        continue;
      }

      results.push({
        sourceName,
        amount,
        scheduleType,
      });
    }
  }

  return results;
}

function inferScheduleType(sheetName, row) {
  const normalizedSheetName = normalizeHeader(sheetName);

  if (normalizedSheetName.includes("schedule c") || normalizedSheetName === "c") {
    return "C";
  }

  if (normalizedSheetName.includes("schedule d") || normalizedSheetName === "d") {
    return "D";
  }

  if (normalizedSheetName.includes("schedule e") || normalizedSheetName === "e") {
    return "E";
  }

  const rowKeys = Object.keys(row).map(normalizeHeader).join(" ");

  if (rowKeys.includes("income")) {
    return "C";
  }

  if (rowKeys.includes("gift")) {
    return "D";
  }

  if (rowKeys.includes("travel")) {
    return "E";
  }

  return "CDE";
}