import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { auditForm700Workbook, compareScheduleRows } from '../../src/ingestion/form700Audit.js';

const workbookPath = new URL('../../../docs/County of Sonoma -- Form 700 (2019).xlsx', import.meta.url);

describe('independent Form 700 supported-column audit', () => {
  it('compares multisets and exposes duplicates, omissions, and changed fields', () => {
    expect(compareScheduleRows([{ x: 1 }, { x: 1 }], [{ x: 1 }])).toMatchObject({ equal: false, missing: [{ x: 1 }] });
    expect(compareScheduleRows([{ x: 1 }], [{ x: 2 }])).toMatchObject({ equal: false, unexpected: [{ x: 2 }] });
    expect(compareScheduleRows([{ a: 1, b: 2 }], [{ b: 2, a: 1 }]).equal).toBe(true);
  });

  it('reconciles all supported Sonoma columns and keeps amendment omissions visible', () => {
    const audit = auditForm700Workbook(readFileSync(workbookPath));
    expect(audit.supportedFieldsReconcile).toBe(true);
    expect(audit.filings).toHaveLength(13);
    expect(audit.filings.reduce((n, f) => n + Object.values(f.schedules).reduce((sum, s) => sum + s.expected, 0), 0)).toBe(78);
    const gore = audit.filings.find(f => f.filer === 'James M Gore');
    expect(gore.amendmentReviewRequired).toBe(true);
    expect(gore.olderRowsNotActive).toHaveLength(15);
    expect(new Set(gore.olderRowsNotActive.map(r => r.schedule))).toEqual(new Set(['A2', 'B', 'CDE']));
    expect(audit.filings.find(f => f.filer === 'Lynda Hopkins').olderRowsNotActive).toHaveLength(2);
    expect(audit.filings.every(f => f.selectedSourceRows.every(r => r.row >= 2))).toBe(true);
  });

  it('fails visibly for an unsupported source column instead of certifying it', () => {
    const book = XLSX.read(readFileSync(workbookPath), { type: 'buffer' });
    const sheet = book.Sheets['Schedule A1'];
    sheet.L1.v = 'Unknown entity column';
    expect(() => auditForm700Workbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))).toThrow('missing column');
  });

  it('CLI requires explicit arguments and writes a private audit without overwriting results', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fair-audit-'));
    const output = join(directory, 'report.json');
    try {
      const invalid = spawnSync(process.execPath, ['scripts/sonoma-pilot.mjs'], { encoding: 'utf8' });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain('Usage:');
      const args = ['scripts/sonoma-pilot.mjs', '--workbook', fileURLToPath(workbookPath), '--output', output, '--audit-only'];
      const valid = spawnSync(process.execPath, args, { encoding: 'utf8' });
      expect(valid.status, valid.stderr).toBe(0);
      expect(JSON.parse(readFileSync(output)).workbookAudit.supportedFieldsReconcile).toBe(true);
      expect(spawnSync(process.execPath, args, { encoding: 'utf8' }).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 20000);
});