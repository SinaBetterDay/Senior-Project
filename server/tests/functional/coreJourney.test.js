import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import * as XLSX from 'xlsx';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const external = vi.hoisted(() => ({
  archivedWorkbooks: new Map(),
  reportHtml: '',
  legistarItems: [],
}));

vi.mock('../../src/lib/auth.js', () => {
  const requireAdmin = (req, res, next) => {
    if (req.headers.authorization !== 'Bearer functional-admin') {
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.user = { id: 'fa170000-0000-4000-8000-000000000002', email: 'admin@fair.test' };
    req.adminMember = { userId: req.user.id, role: 'owner', active: true };
    return next();
  };
  return {
    requireAdmin,
    default: requireAdmin,
    requireAuthenticated: requireAdmin,
    requireOwner: (req, res, next) => req.adminMember?.active && req.adminMember.role === 'owner'
      ? next() : res.status(403).json({ error: 'owner required' }),
  };
});

// The journey exercises synchronous real redetection below. Do not start a second
// background detector that races assertions or fixture cleanup.
vi.mock('../../src/detection/detectionRuns.js', async (importOriginal) => ({
  ...(await importOriginal()),
  queueDetectionRun: vi.fn(),
}));

vi.mock('../../src/lib/storage.js', () => ({
  XLSX_MIME: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  archiveWorkbook: vi.fn(async (buffer, filename, { filingId, politicianId }) => {
    const storagePath = `functional/${politicianId}/${filingId}/${filename}`;
    external.archivedWorkbooks.set(storagePath, Buffer.from(buffer));
    return storagePath;
  }),
  deleteWorkbook: vi.fn(async (storagePath) => external.archivedWorkbooks.delete(storagePath)),
  getWorkbook: vi.fn(async (storagePath) => external.archivedWorkbooks.get(storagePath)),
}));

vi.mock('../../src/ingestion/legistar.js', () => ({
  fetchLegistarAgendaItemsForDataSource: vi.fn(async () => ({
    meetings: [{ EventId: 700, EventDate: '2019-06-11T00:00:00.000Z' }],
    allItems: external.legistarItems,
  })),
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: async () => ({
        setContent: async (html) => { external.reportHtml = html; },
        pdf: async () => Buffer.from('%PDF-functional'),
      }),
      close: async () => {},
    })),
  },
}));

import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { detectConflictsForAgendaItems } from '../../src/detection/detectConflicts.js';
import { redetectDisclosureAgendaItems } from '../../src/detection/redetectDisclosure.js';
import { runLegistarSyncForCity } from '../../src/jobs/nightlySync.js';
import { runApifyAgendaScrape } from '../../src/jobs/runApifyAgendaScrape.js';
import { requireAdmin, requireAuthenticated, requireOwner } from '../../src/lib/auth.js';

const runFunctional = process.env.RUN_FUNCTIONAL_TESTS === 'true';
const describeFunctional = runFunctional ? describe : describe.skip;
const ADMIN = { Authorization: 'Bearer functional-admin' };
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const JURISDICTION_NAME = 'County of Sonoma Functional';
const POLITICIAN_SLUG = 'james-gore-functional';
let jurisdictionId;
let politicianId;
let sql;
let fixtureInitialized = false;

// The historical workbook is a county-wide export. Keep the real schedule values
// but assign this synthetic single-filing scenario one owner/submission, as the
// single-filing upload unit tests do. Never alter the binary source fixture.
const singleWorkbook = XLSX.read(fs.readFileSync(path.resolve('tests/fixtures/form700-valid.xlsx')));
for (const name of singleWorkbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(singleWorkbook.Sheets[name], { header: 1, defval: null });
  const header = rows.findIndex(row => row.includes('Last Name'));
  if (header < 0) continue;
  for (const row of rows.slice(header + 1)) {
    if (!row[0] || !row[1]) continue;
    row[0] = 'Gore'; row[1] = 'James'; row[2] = 'M'; row[7] = 'Annual'; row[10] = 43922;
  }
  singleWorkbook.Sheets[name] = XLSX.utils.aoa_to_sheet(rows);
}
const workbookBuffer = XLSX.write(singleWorkbook, { type: 'buffer', bookType: 'xlsx' });

describe('functional auth mock contract (no database required)', () => {
  it.each([requireAdmin, requireAuthenticated])('rejects missing tokens and supplies owner context for valid tokens', (guard) => {
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    guard({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    const req = { headers: { authorization: 'Bearer functional-admin' } };
    guard(req, res, next);
    expect(req.adminMember).toMatchObject({ active: true, role: 'owner' });
    expect(next).toHaveBeenCalledTimes(1);
    requireOwner(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('rejects non-owner access', () => {
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    requireOwner({ adminMember: { active: true, role: 'admin' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

async function cleanFixtureData() {
  const politicians = await prisma.politician.findMany({
    where: { slug: POLITICIAN_SLUG },
    select: { id: true },
  });
  const politicianIds = politicians.map(({ id }) => id);
  const sources = await prisma.dataSource.findMany({
    where: { cityName: JURISDICTION_NAME },
    select: { id: true },
  });
  const sourceIds = sources.map(({ id }) => id);
  const agendaItems = await prisma.agendaItem.findMany({
    where: { cityName: JURISDICTION_NAME },
    select: { id: true },
  });
  const agendaItemIds = agendaItems.map(({ id }) => id);

  if (politicianIds.length) await prisma.conflictReview.deleteMany({ where: { conflict: { politicianId: { in: politicianIds } } } });
  if (politicianIds.length) await prisma.conflict.deleteMany({ where: { politicianId: { in: politicianIds } } });
  if (agendaItemIds.length) await prisma.voteRecord.deleteMany({ where: { agendaItemId: { in: agendaItemIds } } });
  if (politicianIds.length) await prisma.form700Filing.deleteMany({ where: { politicianId: { in: politicianIds } } });
  if (agendaItemIds.length) await prisma.agendaItem.deleteMany({ where: { id: { in: agendaItemIds } } });
  if (sourceIds.length) await prisma.syncLog.deleteMany({ where: { dataSourceId: { in: sourceIds } } });
  if (sourceIds.length) await prisma.dataSource.deleteMany({ where: { id: { in: sourceIds } } });
  if (politicianIds.length) await prisma.politician.deleteMany({ where: { id: { in: politicianIds } } });
  await prisma.meeting.deleteMany({ where: { jurisdiction: { name: JURISDICTION_NAME } } });
  await prisma.jurisdiction.deleteMany({ where: { name: JURISDICTION_NAME } });
}

describeFunctional('SH-328 core user journey', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('fair_test')) {
      throw new Error('Functional tests require an isolated database whose URL contains "fair_test".');
    }
    vi.stubEnv('FAIR_FILING_PERIOD_OFFSETS', '0');
    fixtureInitialized = true;
    sql = postgres(process.env.DATABASE_URL, { max: 1 });
    await cleanFixtureData();
    const jurisdiction = await prisma.jurisdiction.create({
      data: { name: JURISDICTION_NAME, type: 'county' },
    });
    jurisdictionId = jurisdiction.id;
    const politician = await prisma.politician.create({
      data: {
        slug: POLITICIAN_SLUG,
        fullName: 'James M Gore',
        officeTitle: 'Supervisor',
        district: '4',
        jurisdictionId,
      },
    });
    politicianId = politician.id;
    external.legistarItems = [{
      meetingId: 700,
      meeting: { EventBodyName: 'Board of Supervisors', EventDate: '2019-06-11T00:00:00.000Z' },
      item: { EventItemId: 7001, EventItemTitle: 'Approve a service agreement with Scoop' },
    }];
  });

  afterAll(async () => {
    if (!fixtureInitialized) return;
    try {
      await cleanFixtureData();
    } finally {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      external.archivedWorkbooks.clear();
      await sql?.end();
      await prisma.$disconnect();
    }
  });

  it('ingests agenda data before a disclosure, uploads, detects, reviews, redetects, and displays the result', async () => {
    const legistar = await runLegistarSyncForCity(
      sql,
      { id: 'functional-legistar', city_name: JURISDICTION_NAME, legistar_base_url: 'https://legistar.test' },
      new Set([
        'id', 'legistar_item_id', 'source_type', 'legistar_event_id', 'legistar_matter_id',
        'city_name', 'title', 'agenda_number', 'body_name', 'meeting_date',
        'event_item_passed_flag', 'legistar_item_payload',
      ]),
      { detectionDependencies: { prisma } },
    );
    expect(legistar).toMatchObject({ itemsInserted: 1, conflictsDetected: 0 });

    const apify = await runApifyAgendaScrape({
      prismaClient: prisma,
      scrapeAgendaPDFs: vi.fn().mockResolvedValue([{
        pdf_url: 'https://agendas.test/sonoma.pdf',
        city_name: JURISDICTION_NAME,
        meeting_date: '2019-07-09',
      }]),
      fetchImpl: vi.fn().mockResolvedValue(new Response('%PDF-1.7 functional pdf')),
      parsePdf: vi.fn(async (_buffer, cityId, meetingDate) => [{
        cityId,
        meetingDate,
        itemNumber: '8.2',
        title: 'Scoop technology agreement',
        itemText: 'Authorize the County to execute an agreement with Scoop.',
        sourceType: 'pdf',
      }]),
      log: vi.fn(),
    });
    expect(apify).toMatchObject({ inserted: 1, conflictsDetected: 0, errors: 0 });

    const workbook = workbookBuffer;
    const unauthorized = await request(app)
      .post('/api/admin/upload/form700')
      .field('politician_id', politicianId)
      .attach('file', workbook, { filename: 'form700-valid.xlsx', contentType: XLSX_MIME });
    expect(unauthorized.status).toBe(401);

    const upload = await request(app)
      .post('/api/admin/upload/form700')
      .set(ADMIN)
      .field('politician_id', politicianId)
      .attach('file', workbook, { filename: 'form700-valid.xlsx', contentType: XLSX_MIME });
    expect(upload.status).toBe(200);
    expect(upload.body.schedules_parsed).toEqual({ A: 39, B: 15, CDE: 24, A2: 17 });
    expect(upload.body.detection).toMatchObject({ agenda_items_processed: 2, conflicts_detected: 2, failures: [] });
    expect(external.archivedWorkbooks.get(upload.body.archived_path).equals(workbook)).toBe(true);

    const storedFiling = await prisma.form700Filing.findUnique({ where: { id: upload.body.filing_id } });
    expect(storedFiling.archivedPath).toBe(upload.body.archived_path);
    expect(await prisma.scheduleAInvestment.count({ where: { filingId: storedFiling.id } })).toBe(39);
    expect(await prisma.scheduleBRealEstate.count({ where: { filingId: storedFiling.id } })).toBe(15);
    expect(await prisma.scheduleCdeIncome.count({ where: { filingId: storedFiling.id } })).toBe(24);
    expect(await prisma.scheduleA2BusinessPosition.count({ where: { filingId: storedFiling.id } })).toBe(17);

    const conflicts = await prisma.conflict.findMany({
      where: { politicianId, entityName: 'Scoop' },
      orderBy: { id: 'asc' },
    });
    expect(conflicts).toHaveLength(2);

    const unauthorizedReview = await request(app)
      .post(`/api/admin/conflicts/${conflicts[0].id}/review`)
      .send({ status: 'not_applicable', note: 'Unauthorized review attempt.' });
    expect(unauthorizedReview.status).toBe(401);

    const review = await request(app)
      .post(`/api/admin/conflicts/${conflicts[0].id}/review`)
      .set(ADMIN)
      .send({ status: 'not_applicable', note: 'Reviewed in the functional scenario.' });
    expect(review.status).toBe(200);
    expect(review.body.data.reviewStatus).toBe('not_applicable');

    const redetection = await redetectDisclosureAgendaItems({ politicianId, filingYear: 2019, prisma });
    expect(redetection).toMatchObject({ agendaItemsProcessed: 2, conflictsDetected: 0, conflictsSkipped: 2 });
    const reviewed = await prisma.conflict.findUnique({ where: { id: conflicts[0].id }, include: { reviews: true } });
    expect(reviewed).toMatchObject({ reviewStatus: 'not_applicable', reviewNote: 'Reviewed in the functional scenario.' });
    expect(reviewed.reviews).toHaveLength(1);

    const dashboard = await request(app).get('/api/conflicts');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.filter((row) => row.politicianName === 'James M Gore')).toHaveLength(2);

    const conflictDetail = await request(app).get(`/api/conflicts/${conflicts[0].id}`);
    expect(conflictDetail.status).toBe(200);
    expect(conflictDetail.body.data).toMatchObject({ entityName: 'Scoop', politician: { name: 'James M Gore' } });

    const politician = await request(app).get(`/api/politicians/${POLITICIAN_SLUG}`);
    expect(politician.status).toBe(200);
    expect(politician.body.data.filings).toHaveLength(1);

    const agendaId = conflicts[0].agendaItemId;
    const agenda = await request(app).get(`/api/agenda/${agendaId}`);
    expect(agenda.status).toBe(200);
    expect(agenda.body.data.conflicts).toHaveLength(1);

    const search = await request(app).get('/api/search').query({ q: 'Scoop' });
    expect(search.status).toBe(200);
    expect(search.body.groups.conflicts.some((row) => row.id === conflicts[0].id)).toBe(true);

    const csv = await request(app).get('/api/conflicts/export').query({ city: JURISDICTION_NAME });
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('James M Gore');
    expect(csv.text).toContain('Scoop');

    const pdf = await request(app).post('/api/admin/reports/pdf').set(ADMIN).send({ scope: 'city', city: JURISDICTION_NAME });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect(external.reportHtml).toContain('James M Gore');
    expect(external.reportHtml).toContain('Scoop');
  }, 30_000);

  it('covers malformed workbooks, failed PDFs, and retryable detection failure', async () => {
    const malformed = fs.readFileSync(path.resolve('tests/fixtures/form700-malformed.xlsx'));
    const upload = await request(app)
      .post('/api/admin/upload/form700')
      .set(ADMIN)
      .field('politician_id', politicianId)
      .field('filing_year', '2020')
      .attach('file', malformed, { filename: 'malformed.xlsx', contentType: XLSX_MIME });
    expect(upload.status).toBe(400);

    const failedPdf = await runApifyAgendaScrape({
      prismaClient: prisma,
      scrapeAgendaPDFs: vi.fn().mockResolvedValue([{
        pdf_url: 'https://agendas.test/missing.pdf', city_name: JURISDICTION_NAME, meeting_date: '2019-08-01',
      }]),
      fetchImpl: vi.fn().mockResolvedValue(new Response('missing', { status: 503, statusText: 'Unavailable' })),
      log: vi.fn(),
    });
    expect(failedPdf).toMatchObject({ inserted: 0, skipped: 1, errors: 1 });

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failedDetection = await redetectDisclosureAgendaItems({
      politicianId,
      filingYear: 2019,
      prisma,
      detect: vi.fn().mockRejectedValue(new Error('temporary detector failure')),
    });
    expect(failedDetection.detectionErrors).toEqual([
      expect.objectContaining({ message: 'temporary detector failure' }),
    ]);
    const retry = await redetectDisclosureAgendaItems({ politicianId, filingYear: 2019, prisma, detect: detectConflictsForAgendaItems });
    expect(retry.detectionErrors).toEqual([]);
  }, 20_000);
});