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

  const sheet = findSheetByName(workbook, [
    "schedule b",
    "real estate",
  ]);

  if (!sheet) {
    return [];
  }

  // Schedule B uses row 2 as the real header row
  const jsonRows = sheetToObjects(sheet, 1);
  const results = [];

  for (const row of jsonRows) {
    const propertyDescription = getField(row, [
      "street address or precise location",
      "street address or precise location of real property",
      "street address or precise location of real property city and county or area if outside of california",
      "street address or precise location ",
      "property description",
      "real property",
      "address",
      "location",
    ]);

    const city = getField(row, [
      "city",
      "city and state",
      "city or area if outside california",
      "city or area if outside of california",
    ]);

    const county = getField(row, [
      "county",
      "county or area if outside california",
      "county or area if outside of california",
    ]);

    const fairMarketValue = getField(row, [
      "fair market value",
      "fair market value (select from drop down list)",
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