import {
  findSheetByName,
  getField,
  isMeaningfulRow,
  loadWorkbook,
  sheetToObjects,
} from "./parserUtils.js";

export function parseScheduleA(input) {
  const workbook = loadWorkbook(input);

  if (!workbook) {
    return [];
  }

  const sheet = findSheetByName(workbook, ["schedule a", "a investments", "investments"]);

  if (!sheet) {
    return [];
  }

  const jsonRows = sheetToObjects(sheet);
  const results = [];

  for (const row of jsonRows) {
    const entityName = getField(row, [
      "name of business entity",
      "name of investment",
      "business entity",
      "entity name",
      "name",
    ]);

    const fairMarketValue = getField(row, [
      "fair market value",
      "value",
      "fmv",
    ]);

    const natureOfInvestment = getField(row, [
      "nature of investment",
      "type of investment",
      "investment type",
    ]);

    if (!isMeaningfulRow([entityName, fairMarketValue, natureOfInvestment])) {
      continue;
    }

    results.push({
      entityName,
      fairMarketValue,
      natureOfInvestment,
    });
  }

  return results;
}