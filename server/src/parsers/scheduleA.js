//Rhys Honaker
import * as XLSX from "xlsx";

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findScheduleASheetName(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return null;
  }

  return workbook.SheetNames.find((sheetName) => {
    const normalized = normalizeHeader(sheetName);
    return normalized === "schedule a" || normalized.includes("schedule a");
  });
}

function getColumnValue(row, normalizedHeaderName) {
  for (const key of Object.keys(row)) {
    if (normalizeHeader(key) === normalizedHeaderName) {
      return row[key];
    }
  }
  return null;
}

function mapRowToScheduleARecord(row, filingId, politicianId) {
  const entityName = cleanText(getColumnValue(row, "name of business entity"));
  if (!entityName) {
    return null;
  }

  return {
    entity_name: entityName,
    fair_market_value: cleanText(getColumnValue(row, "fair market value")),
    nature_of_investment: cleanText(getColumnValue(row, "nature of investment")),
    politician_id: politicianId,
    filing_id: filingId,
  };
}

export async function parseScheduleA(xlsxString, filingId) {
  if (!xlsxString) {
    console.log("parseScheduleA: no XLSX content provided.");
    return [];
  }

  let workbook;
  try {
    const readOptions = typeof xlsxString === "string" ? { type: "binary" } : { type: "buffer" };
    workbook = XLSX.read(xlsxString, readOptions);
  } catch (error) {
    console.error("parseScheduleA: failed to read XLSX document.", error);
    return [];
  }

  const sheetName = findScheduleASheetName(workbook);
  if (!sheetName) {
    console.log("parseScheduleA: Schedule A sheet not found.");
    return [];
  }

  const worksheet = workbook.Sheets?.[sheetName];
  if (!worksheet) {
    console.log("parseScheduleA: Schedule A worksheet is missing.");
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("parseScheduleA: Schedule A sheet is empty.");
    return [];
  }

  const filing = await prisma.filings.findUnique({
    where: { id: filingId },
    select: { politician_id: true },
  });

  if (!filing) {
    console.error(`parseScheduleA: filing ${filingId} not found.`);
    return [];
  }

  const politicianId = filing.politician_id;
  const records = rows
    .filter((row) => row && typeof row === "object")
    .map((row) => mapRowToScheduleARecord(row, filingId, politicianId))
    .filter((record) => record !== null);

  if (records.length === 0) {
    console.log("parseScheduleA: no valid Schedule A investment records found.");
    return [];
  }

  try {
    const result = await prisma.schedule_a_investments.createMany({
      data: records,
      skipDuplicates: true,
    });

    console.log(`Inserted ${result.count} Schedule A records for filing ${filingId}.`);
    return records;
  } catch (error) {
    console.error("parseScheduleA: failed to insert schedule_a_investments.", error);
    return [];
  }
}
