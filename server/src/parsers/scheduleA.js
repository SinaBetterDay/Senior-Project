//Rhys Honaker
import { read, utils } from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Parses Schedule A entries from a Form 700 XLSX document and inserts them
 * into the schedule_a_investments table.
 *
 * @param {Buffer|string} xlsxBuffer - The XLSX file as a Buffer or binary string
 * @param {number} filingId - The ID of the filing record these investments relate to
 * @returns {Promise<Array>} Array of inserted record objects:
 *         { entity_name, fair_market_value, nature_of_investment, politician_id, filing_id }
 *         Returns empty array if no Schedule A sheet found or no valid entries.
 *
 * @example
 * const buffer = fs.readFileSync('form700.xlsx');
 * const records = await parseScheduleA(buffer, 42);
 * // Output: console.log: "Inserted 5 Schedule A investment records"
 */

export async function parseScheduleA(xlsxBuffer, filingId) {
  try {
    // Parse the XLSX file
    const workbook = read(xlsxBuffer, { type: 'buffer' });

    // Find the Schedule A sheet (case-insensitive search)
    const scheduleASheet = workbook.SheetNames.find(
      (name) => name.toLowerCase() === 'schedule a1'
    );

    if (!scheduleASheet) {
      console.log('No Schedule A sheet found, returning empty array');
      return [];
    }

    // Convert sheet to JSON
    const worksheet = workbook.Sheets[scheduleASheet];
    const rawRows = utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      console.log('Schedule A sheet is empty.');
      return [];
    }

    // Get the politician_id from the filing record
    const filing = await prisma.filings.findUnique({
      where: { id: filingId },
      select: { politician_id: true },
    });

    if (!filing) {
      console.error(`Filing with ID ${filingId} not found.`);
      return [];
    }

    const politicianId = filing.politician_id;

    // Map and filter rows to structured format
    const recordsToInsert = rawRows
      .map((row) => {
        const entityName = String(row['NAME OF BUSINESS ENTITY'] || '').trim();
        const fairMarketValue = String(row['FAIR MARKET VALUE'] || '').trim();
        const natureOfInvestment = String(row['NATURE OF INVESTMENT'] || '').trim();

        // Skip rows with empty entity names (headers or blank rows)
        if (!entityName) {
          return null;
        }

        return {
          entity_name: entityName,
          fair_market_value: fairMarketValue || null,
          nature_of_investment: natureOfInvestment || null,
          politician_id: politicianId,
          filing_id: filingId,
        };
      })
      .filter((record) => record !== null);

    // Early return if no valid records
    if (recordsToInsert.length === 0) {
      console.log('No valid Schedule A investment entries found.');
      return [];
    }

    // Insert all records into the database
    const insertedRecords = await prisma.schedule_a_investments.createMany({
      data: recordsToInsert,
    });

    console.log(
      `Inserted ${insertedRecords.count} Schedule A investment records for filing ${filingId}.`
    );

    // Return the records as structured objects
    return recordsToInsert;
  } catch (error) {
    console.error('Error parsing Schedule A:', error);
    return [];
  }
}
