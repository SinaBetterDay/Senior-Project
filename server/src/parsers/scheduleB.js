import {
  findSheetByName,
  getField,
  isMeaningfulRow,
  loadWorkbook,
  sheetToObjects,
} from "./parserUtils.js";

export function parseScheduleB(input) {
  const workbook = loadWorkbook(input);

  if (!workbook) {
    return [];
  }

  const sheet = findSheetByName(workbook, ["schedule b", "real estate"]);

  if (!sheet) {
    return [];
  }

  const jsonRows = sheetToObjects(sheet);
  const results = [];

  for (const row of jsonRows) {
    const propertyDescription = getField(row, [
      "street address or precise location of real property",
      "property description",
      "real property",
      "address",
      "location",
    ]);

    const city = getField(row, ["city"]);
    const county = getField(row, ["county"]);
    const fairMarketValue = getField(row, [
      "fair market value",
      "value",
      "fmv",
    ]);

    if (!isMeaningfulRow([propertyDescription, city, county, fairMarketValue])) {
      continue;
    }

    results.push({
      propertyDescription,
      city,
      county,
      fairMarketValue,
    });
  }

  return results;
}