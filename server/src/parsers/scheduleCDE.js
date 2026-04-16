import * as XLSX from "xlsx";

//clean up value: remove extra spaces and return null if empty
function cleanText(value) {
    if (value == null)
        return null;
    const text = String(value).trim();
    return text === "" ? null : text;
}

//format header for easier comparison
function normalizeHeader(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

//looks for sheet that contains "schedule c" in title regardless of case
function looksLikeScheduleCSheet(sheetName) {
  const normalized = normalizeHeader(sheetName);
  return normalized === "schedule c" || normalized.includes("schedule c");
}

//looks for sheet that contains "schedule d" in title regardless of case
function looksLikeScheduleDSheet(sheetName) {
  const normalized = normalizeHeader(sheetName);
  return normalized === "schedule d" || normalized.includes("schedule d");
}

//looks for sheet that contains "schedule e" in title regardless of case
function looksLikeScheduleESheet(sheetName) {
  const normalized = normalizeHeader(sheetName);
  return normalized === "schedule e" || normalized.includes("schedule e");
}

//find schedule c's sheet name amongst workbook sheetnames
function findScheduleCSheetName(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return null;
  }
  return workbook.SheetNames.find(looksLikeScheduleCSheet) ?? null;
}

//find schedule d's sheet name amongst workbook sheetnames
function findScheduleDSheetName(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return null;
  }
  return workbook.SheetNames.find(looksLikeScheduleDSheet) ?? null;
}

//find schedule e's sheet name amongst workbook sheetnames
function findScheduleESheetName(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return null;
  }
  return workbook.SheetNames.find(looksLikeScheduleESheet) ?? null;
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

//look for meaningful/non-empty in key fields for CDE
function hasMeaningfulScheduleCDEData(row) {
  const sourceName = getFirstPresentValue(row, [
    "SOURCE",
    "Source",
    "SOURCE OF INCOME",
    "Source of Income",
    "SOURCE OF GIFT",
    "Source of Gift",
    "SOURCE OF PAYMENT",
    "Source of Payment",
  ]);
  const amount = getFirstPresentValue(row, ["AMOUNT", "Amount"]);

  return Boolean(cleanText(sourceName) || cleanText(amount));
}

//parse a specific schedule sheet
function parseScheduleSheet(workbook, sheetName, scheduleType, filingId) {
  if (!sheetName) return [];

  const worksheet = workbook.Sheets?.[sheetName];
  if (!worksheet) return [];

  const rows = XLSX.utils.sheet_to_json(worksheet, {defval: null});

  return rows
    .filter((row) => row && typeof row === "object")
    .filter(hasMeaningfulScheduleCDEData)
    .map((row) => ({
      source_name: cleanText(
        getFirstPresentValue(row, [
          "SOURCE",
          "Source",
          "SOURCE OF INCOME",
          "Source of Income",
          "SOURCE OF GIFT",
          "Source of Gift",
          "SOURCE OF PAYMENT",
          "Source of Payment",
        ])
      ),
      amount: cleanText(getFirstPresentValue(row, ["AMOUNT", "Amount"])),
      schedule_type: scheduleType,
      filing_id: filingId,
    }));
}

//main function
export function parseScheduleCDE(xlsxBuffer, filingId) {
  if (!xlsxBuffer) return [];

  let workbook;
  try {
    workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
  } catch (error) {
    console.error('Error reading XLSX:', error);
    return [];
  }

  const results = [];

  // Parse Schedule C
  const sheetC = findScheduleCSheetName(workbook);
  results.push(...parseScheduleSheet(workbook, sheetC, 'C', filingId));

  // Parse Schedule D
  const sheetD = findScheduleDSheetName(workbook);
  results.push(...parseScheduleSheet(workbook, sheetD, 'D', filingId));

  // Parse Schedule E
  const sheetE = findScheduleESheetName(workbook);
  results.push(...parseScheduleSheet(workbook, sheetE, 'E', filingId));

  return results;
}