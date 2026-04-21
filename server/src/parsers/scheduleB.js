import * as XLSX from "xlsx";

//clean up value: remove extra spaces and return null if empty
function cleanText(value) {
    if (value == null) 
        return null;
    const text = String(value).trim();
    return text === "" ? null : text;
}

//convert text to title case: Hello World
function toTitleCase(value) {
    const text = cleanText(value);
    if (!text) return null;

    return text
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

//obtain city name without state
function normalizeCity(value) {
    const text = cleanText(value);
    if (!text) return null;

    const cityOnly = text.split(",")[0].trim();
    return toTitleCase(cityOnly);
}

//format header for easier comparison
function normalizeHeader(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

//looks for sheet that contains "schedule b" in title regardless of case
function looksLikeScheduleBSheet(sheetName) {
  const normalized = normalizeHeader(sheetName);

  return normalized === "schedule b" || normalized.includes("schedule b");
}

//find schedule b's sheet name amongst workbook sheetnames
function findScheduleBSheetName(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return null;
  }

  return workbook.SheetNames.find(looksLikeScheduleBSheet) ?? null;
}

//based on possible keys, find column name that matches, parses multiple headers
function getFirstPresentValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (key in row) {
      return row[key];
    }
  }

  return null;
}

//look for meaningful/non-empty in key fields
function hasMeaningfulScheduleBData(row) {
  const propertyDescription = getFirstPresentValue(row, [
    "STREET ADDRESS OR PRECISE LOCATION ",
    "STREET ADDRESS OR PRECISE LOCATION",
    "Property Description",
    "Parcel Description",
  ]);

  const city = getFirstPresentValue(row, ["CITY", "City"]);
  const fairMarketValue = getFirstPresentValue(row, [
    "FAIR MARKET VALUE",
    "Fair Market Value",
  ]);
  const natureOfInterest = getFirstPresentValue(row, [
    "NATURE OF INTEREST",
    'NATURE OF INTEREST \n(if "other," describe)',
    "Nature of Interest",
  ]);

  return Boolean(
    cleanText(propertyDescription) ||
      cleanText(city) ||
      cleanText(fairMarketValue) ||
      cleanText(natureOfInterest)
  );
}

//main function
export function parseScheduleB(workBook, filingID) {
    //check if workBook is empty
    if (!workBook)
        return [];
    
    //locate schedule b from the workbook
    const sheetName = findScheduleBSheetName(workBook);
    if (!sheetName)
        return [];

    //get worksheet object
    const worksheet = workBook.Sheets?.[sheetName];
    if (!worksheet)
        return [];

    //convert worksheet to row objects
    const rows = XLSX.utils.sheet_to_json(worksheet, {defval: null, });

    //return structured object
    //Returns structured objects: { property_description, city, Agency, fair_market_value, nature_of_interest, filing_id }
    return rows
        .filter((row) => row && typeof row === "object")
        .filter(hasMeaningfulScheduleBData)
        .map((row) => ({
            property_description: cleanText(
                getFirstPresentValue(row, [
                    "STREET ADDRESS OR PRECISE LOCATION ",
                    "STREET ADDRESS OR PRECISE LOCATION",
                    "Property Description",
                    "Parcel Description",
                ])
            ),
            city: normalizeCity(getFirstPresentValue(row, ["CITY", "City"])),
            agency: toTitleCase(getFirstPresentValue(row, ["Agency", "AGENCY"])),
            fair_market_value: cleanText(
                getFirstPresentValue(row, ["FAIR MARKET VALUE", "Fair Market Value"])
            ),
            nature_of_interest: cleanText(
                getFirstPresentValue(row, [
                    "NATURE OF INTEREST", 
                    'NATURE OF INTEREST \n(if "other," describe)', 
                    "Nature of Interest",
                ])),
            filing_id: filingID,
        }));

    //ISSUE: "county"=Agency and 'parcel description' is not explicitly in schedule b

    
    
}

