import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { auditForm700Workbook } from '../src/ingestion/form700Audit.js';
import { auditForm700Database } from '../src/ingestion/form700DatabaseAudit.js';
import { runLegistarPilot } from '../src/ingestion/legistarPilot.js';

const { values } = parseArgs({ options: {
  workbook: { type: 'string' }, output: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
  'max-matters': { type: 'string', default: '200' }, 'max-pdfs': { type: 'string', default: '40' },
  database: { type: 'boolean', default: false }, 'audit-only': { type: 'boolean', default: false },
} });

try {
  if (!values.workbook || !values.output || (!values['audit-only'] && (!values.start || !values.end))) {
    throw new Error('Usage: node server/scripts/sonoma-pilot.mjs --workbook /absolute/file.xlsx --output /absolute/report.json [--audit-only | --start YYYY-MM-DD --end YYYY-MM-DD] [--database] [--max-matters 200] [--max-pdfs 40]');
  }
  const audit = auditForm700Workbook(await readFile(resolve(values.workbook)));
  const { parsed, ...workbookAudit } = audit;
  const report = { generatedAt: new Date().toISOString(), workbook: resolve(values.workbook), workbookAudit };
  if (values.database) {
    dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
    const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
    if (!url) throw new Error('Database audit requested but no connection configured');
    const sql = postgres(url, { max: 1, connect_timeout: 10 });
    try { report.databaseAudit = await auditForm700Database(sql, parsed); }
    catch (error) { report.databaseAudit = { status: 'failed', code: error.code ?? 'unknown', message: 'Read-only comparison failed; inspect database connectivity/schema locally.' }; }
    finally { await sql.end({ timeout: 2 }); }
  }
  if (!values['audit-only']) report.legistar = await runLegistarPilot({ filings: parsed.filings, startDate: values.start, endDate: values.end,
    maxMatters: Number(values['max-matters']), maxPdfs: Number(values['max-pdfs']), log: message => console.error(message) });
  await writeFile(resolve(values.output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ output: resolve(values.output), workbookFieldsReconcile: audit.supportedFieldsReconcile,
    databaseRowsReconcile: report.databaseAudit?.allSupportedRowsEqual ?? null, comparison: report.legistar?.comparison,
    errors: report.legistar?.errors.length ?? 0 }, null, 2));
  if (!audit.supportedFieldsReconcile || report.databaseAudit?.status === 'failed' || report.databaseAudit?.allSupportedRowsEqual === false) process.exitCode = 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}