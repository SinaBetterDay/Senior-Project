import { compareScheduleRows } from './form700Audit.js';

const TABLES = { A: 'schedule_a_investments', A2: 'schedule_a2_business_positions', B: 'schedule_b_realestate', CDE: 'schedule_cde_income' };

// The caller supplies a postgres connection; the transaction enforces read-only
// even if later maintenance accidentally introduces a write in this audit.
export async function auditForm700Database(sql, parsed) {
  return sql.begin('read only', async tx => {
    await tx`SET LOCAL statement_timeout = 15000`;
    const filings = await tx`SELECT f.id, f.filing_year, f.import_metadata, p.full_name, p.needs_review, j.name AS jurisdiction
      FROM form700_filings f JOIN politicians p ON p.id = f.politician_id
      LEFT JOIN jurisdictions j ON j.id = p.jurisdiction_id
      WHERE j.name ILIKE ${'%sonoma%'}`;
    const results = [];
    for (const expected of parsed.filings) {
      const matches = filings.filter(f => f.full_name === expected.filer_name && f.filing_year === expected.filing_year && f.jurisdiction.toLowerCase() === expected.agency.toLowerCase());
      if (matches.length !== 1) { results.push({ filer: expected.filer_name, status: matches.length ? 'ambiguous' : 'missing' }); continue; }
      const filing = matches[0];
      const schedules = {};
      for (const [schedule, table] of Object.entries(TABLES)) {
        const stored = await tx`SELECT * FROM ${tx(table)} WHERE filing_id = ${filing.id}`;
        const keys = Object.keys(expected.schedules[schedule][0] ?? {
          ...(schedule === 'A' ? { entity_name: null, fair_market_value: null, nature_of_investment: null } :
            schedule === 'A2' ? { entity_name: null, business_position: null, fair_market_value: null, nature_of_investment: null, gross_income_range: null } :
              schedule === 'B' ? { property_description: null, city: null, county: null, fair_market_value: null, nature_of_interest: null } :
                { source_name: null, amount: null, schedule_type: null }), filing_id: null,
        });
        schedules[schedule] = compareScheduleRows(expected.schedules[schedule], stored.map(row => Object.fromEntries(keys.map(key => [key, key === 'filing_id' ? null : row[key]]))));
      }
      results.push({ filer: expected.filer_name, status: 'compared', identityNeedsReview: filing.needs_review,
        digestMatches: filing.import_metadata?.digest === parsed.digest, selection: filing.import_metadata?.selection ?? null, schedules });
    }
    const agendaYears = await tx`SELECT extract(year from meeting_date)::int AS year, count(*)::int AS items
      FROM agenda_items WHERE city_name ILIKE ${'%sonoma%'} GROUP BY 1 ORDER BY 1`;
    return { mode: 'read_only_transaction', storedSonomaFilings: filings.length, results, agendaYears,
      allSupportedRowsEqual: results.every(r => r.status === 'compared' && Object.values(r.schedules).every(s => s.equal)) };
  });
}