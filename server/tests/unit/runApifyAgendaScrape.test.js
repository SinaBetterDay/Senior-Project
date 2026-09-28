import { describe, expect, it, vi } from 'vitest';
import { downloadPdf, runApifyAgendaScrape } from '../../src/jobs/runApifyAgendaScrape.js';

function createPrismaDouble() {
  const sources = [];
  const agendaItems = new Map();
  const syncLogs = [];
  let sourceNumber = 0;
  let syncLogNumber = 0;
  const agendaKey = (key) => JSON.stringify({
    cityId: key.cityId,
    meetingDate: new Date(key.meetingDate).toISOString(),
    itemNumber: key.itemNumber,
  });

  const prisma = {
    dataSource: {
      findFirst: vi.fn(async ({ where }) => sources.find((source) => (
        source.cityName === where.cityName && source.sourceType === where.sourceType
      )) ?? null),
      create: vi.fn(async ({ data }) => {
        const source = { id: `source-${++sourceNumber}`, ...data };
        sources.push(source);
        return source;
      }),
      update: vi.fn(async ({ where, data }) => {
        const source = sources.find((entry) => entry.id === where.id);
        Object.assign(source, data);
        return source;
      }),
    },
    syncLog: {
      create: vi.fn(async ({ data }) => {
        const syncLog = { id: `sync-${++syncLogNumber}`, ...data };
        syncLogs.push(syncLog);
        return syncLog;
      }),
      update: vi.fn(async ({ where, data }) => {
        const syncLog = syncLogs.find((entry) => entry.id === where.id);
        Object.assign(syncLog, data);
        return syncLog;
      }),
    },
    agendaItem: {
      findUnique: vi.fn(async ({ where }) => agendaItems.get(agendaKey(where.cityId_meetingDate_itemNumber)) ?? null),
      upsert: vi.fn(async ({ where, create }) => {
        const key = agendaKey(where.cityId_meetingDate_itemNumber);
        const existing = agendaItems.get(key);
        const row = existing ?? { id: `agenda-${agendaItems.size + 1}`, ...create };
        agendaItems.set(key, row);
        return row;
      }),
    },
    $transaction: vi.fn(async (operations) => Promise.all(operations)),
  };

  return { prisma, sources, agendaItems, syncLogs };
}

function pdfResponse(body = 'pdf') {
  return new Response(body, { headers: { 'content-length': String(Buffer.byteLength(body)) } });
}

describe('downloadPdf', () => {
  it('rejects a PDF whose declared content length exceeds the limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('small', {
      headers: { 'content-length': '21' },
    }));

    await expect(downloadPdf('https://city.test/agenda.pdf', { fetchImpl, maxBytes: 20 }))
      .rejects.toThrow('PDF exceeds 0 MB limit');
  });

  it('returns a buffer for a successful PDF download', async () => {
    const buffer = await downloadPdf('https://city.test/agenda.pdf', {
      fetchImpl: vi.fn().mockResolvedValue(pdfResponse('agenda')),
    });

    expect(buffer.toString()).toBe('agenda');
  });
});

describe('runApifyAgendaScrape', () => {
  const parsePdf = vi.fn(async (_buffer, cityId, meetingDate) => [{
    cityId,
    meetingDate,
    itemNumber: '1',
    itemText: 'Approve a public works contract.',
    sourceType: 'pdf',
  }]);

  it('downloads, parses, persists, and logs an Apify PDF result', async () => {
    const state = createPrismaDouble();
    const scrapeAgendaPDFs = vi.fn().mockResolvedValue([{
      pdf_url: 'https://city.test/agenda.pdf',
      meeting_date: '2026-10-01',
      city_name: 'Test City',
    }]);

    const result = await runApifyAgendaScrape({
      prismaClient: state.prisma,
      scrapeAgendaPDFs,
      parsePdf,
      fetchImpl: vi.fn().mockImplementation(async () => pdfResponse()),
      log: vi.fn(),
    });

    expect(scrapeAgendaPDFs).toHaveBeenCalledWith({ lookbackDays: 14 });
    expect(result).toMatchObject({ citiesProcessed: 1, pdfsFetched: 1, inserted: 1, skipped: 0, errors: 0 });
    expect(state.sources).toHaveLength(1);
    expect(state.sources[0]).toMatchObject({ cityName: 'Test City', sourceType: 'apify', lastError: null });
    expect(state.agendaItems.size).toBe(1);
    expect(state.syncLogs[0]).toMatchObject({ status: 'success', itemsFound: 1, itemsInserted: 1, itemsSkipped: 0, errors: null });
  });

  it('does not duplicate agenda items when the same actor result is rerun', async () => {
    const state = createPrismaDouble();
    const options = {
      prismaClient: state.prisma,
      scrapeAgendaPDFs: vi.fn().mockResolvedValue([{
        pdf_url: 'https://city.test/agenda.pdf', meeting_date: '2026-10-01', city_name: 'Test City',
      }]),
      parsePdf,
      fetchImpl: vi.fn().mockImplementation(async () => pdfResponse()),
      log: vi.fn(),
    };

    await runApifyAgendaScrape(options);
    const rerun = await runApifyAgendaScrape(options);

    expect(state.agendaItems.size).toBe(1);
    expect(rerun).toMatchObject({ inserted: 0, skipped: 1, errors: 0 });
  });

  it('skips one failed PDF, records its error, and continues with the next PDF', async () => {
    const state = createPrismaDouble();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(pdfResponse());

    const result = await runApifyAgendaScrape({
      prismaClient: state.prisma,
      scrapeAgendaPDFs: vi.fn().mockResolvedValue([
        { pdf_url: 'https://city.test/missing.pdf', meeting_date: '2026-10-01', city_name: 'Test City' },
        { pdf_url: 'https://city.test/agenda.pdf', meeting_date: '2026-10-01', city_name: 'Test City' },
      ]),
      parsePdf,
      fetchImpl,
      log: vi.fn(),
    });

    expect(result).toMatchObject({ inserted: 1, skipped: 1, errors: 1 });
    expect(state.agendaItems.size).toBe(1);
    expect(state.syncLogs[0]).toMatchObject({ status: 'success', itemsInserted: 1, itemsSkipped: 1 });
    expect(state.syncLogs[0].errors).toEqual([expect.objectContaining({ pdfUrl: 'https://city.test/missing.pdf' })]);
    expect(state.sources[0].lastError).toContain('PDF download failed (404 Not Found)');
  });

  it('only processes the requested city for a manual city-filtered run', async () => {
    const state = createPrismaDouble();
    const result = await runApifyAgendaScrape({
      city: 'Second City',
      prismaClient: state.prisma,
      scrapeAgendaPDFs: vi.fn().mockResolvedValue([
        { pdf_url: 'https://one.test/agenda.pdf', meeting_date: '2026-10-01', city_name: 'First City' },
        { pdf_url: 'https://two.test/agenda.pdf', meeting_date: '2026-10-02', city_name: 'Second City' },
      ]),
      parsePdf,
      fetchImpl: vi.fn().mockResolvedValue(pdfResponse()),
      log: vi.fn(),
    });

    expect(result).toMatchObject({ citiesProcessed: 1, pdfsFetched: 1, inserted: 1 });
    expect(state.sources).toHaveLength(1);
    expect(state.sources[0].cityName).toBe('Second City');
  });
});