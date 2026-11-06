import { describe, expect, it, vi } from 'vitest';
import { auditForm700Database } from '../../src/ingestion/form700DatabaseAudit.js';

function fixture(rows = [], stored = []) {
  const tx = vi.fn((parts, ...values) => {
      if (typeof parts === 'string') return parts;
      if (parts.join('').includes('FROM form700_filings')) return Promise.resolve(rows);
      if (parts.join('').includes('SELECT *')) return values.includes('schedule_a_investments') ? stored : [];
      return [];
    });
  const sql = { begin: vi.fn(async (mode, fn) => fn(tx)) };
  return { sql, tx };
}
const parsed = { digest: 'abc', filings: [{ filer_name: 'Test Filer', agency: 'County of Sonoma', filing_year: 2019,
  schedules: { A: [{ entity_name: 'Acme', fair_market_value: '$2,000 - $10,000', nature_of_investment: 'Stock', filing_id: null }], A2: [], B: [], CDE: [] } }] };
const filing = { id: 'filing', full_name: 'Test Filer', jurisdiction: 'County of Sonoma', filing_year: 2019, needs_review: true, import_metadata: { digest: 'abc' } };

describe('read-only database reconciliation', () => {
  it('compares supported values rather than just counts or digest', async () => {
    const { sql } = fixture([filing], [{ ...parsed.filings[0].schedules.A[0], filing_id: 'filing', id: 'row' }]);
    const result = await auditForm700Database(sql, parsed);
    expect(sql.begin).toHaveBeenCalledWith('read only', expect.any(Function));
    expect(result.allSupportedRowsEqual).toBe(true);
    expect(result.results[0]).toMatchObject({ digestMatches: true, identityNeedsReview: true });
    const changed = fixture([filing], [{ entity_name: 'Wrong' }]);
    expect((await auditForm700Database(changed.sql, parsed)).allSupportedRowsEqual).toBe(false);
  });

  it.each([{ rows: [] }, { rows: [filing, filing] }])('does not certify missing or ambiguous filings', async ({ rows }) => {
    const result = await auditForm700Database(fixture(rows).sql, parsed);
    expect(result.allSupportedRowsEqual).toBe(false);
    expect(result.results[0].status).toBe(rows.length ? 'ambiguous' : 'missing');
  });
});