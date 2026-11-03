import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../../src/ingestion/pdfParser.js', () => ({ parsePdfAgenda: vi.fn() }));

import { ingestApifyAgendaItems } from '../../src/ingestion/apifyAgenda.js';

const source = { id: 'source-1', cityName: 'Elk Grove', sourceType: 'apify' };
const document = {
  pdf_url: 'https://city.gov/agenda.pdf', title: 'Council agenda', meeting_date: '2026-10-01',
};

let prismaClient;
let fetchImpl;
let parsePdf;

beforeEach(() => {
  prismaClient = {
    agendaItem: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ id: 'agenda-1' }) },
    syncLog: { create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    dataSource: { update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (operation) => (
      typeof operation === 'function' ? operation(prismaClient) : Promise.all(operation)
    )),
  };
  fetchImpl = vi.fn(async () => new Response(Buffer.from('%PDF-1.7 agenda')));
  parsePdf = vi.fn().mockResolvedValue([{
    itemNumber: '1', itemText: 'Approve a public works contract.', meetingDate: '2026-10-01',
  }]);
});

describe('shared Apify agenda ingestion', () => {
  it('persists parsed content, document links, and metrics on the supplied sync run', async () => {
    const result = await ingestApifyAgendaItems({
      items: [document], source, syncLogId: 'sync-1', prismaClient, fetchImpl, parsePdf,
    });

    expect(result).toMatchObject({ documentsFound: 1, pdfsFetched: 1, itemsInserted: 1, errors: [] });
    expect(prismaClient.syncLog.create).not.toHaveBeenCalled();
    expect(prismaClient.agendaItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        sourceType: 'apify', cityId: source.id, title: document.title,
        itemText: 'Approve a public works contract.', sourceUrl: document.pdf_url,
      }),
    }));
    expect(prismaClient.syncLog.update).toHaveBeenCalledWith({
      where: { id: 'sync-1' },
      data: expect.objectContaining({
        status: 'success', documentsFound: 1, pdfsFetched: 1, itemsInserted: 1, errors: null,
      }),
    });
  });

  it('retains failed status and document errors when every PDF download fails', async () => {
    fetchImpl.mockRejectedValue(new Error('Download unavailable'));
    const result = await ingestApifyAgendaItems({
      items: [document], source, syncLogId: 'sync-1', prismaClient, fetchImpl, parsePdf, log: vi.fn(),
    });

    expect(result).toMatchObject({ documentsSkipped: 1, itemsInserted: 0 });
    expect(parsePdf).not.toHaveBeenCalled();
    expect(prismaClient.agendaItem.upsert).not.toHaveBeenCalled();
    expect(prismaClient.syncLog.update).toHaveBeenCalledWith({
      where: { id: 'sync-1' },
      data: expect.objectContaining({
        status: 'failed', documentsSkipped: 1,
        errors: [{ pdfUrl: document.pdf_url, message: 'Download unavailable' }],
      }),
    });
    expect(prismaClient.dataSource.update).toHaveBeenCalledWith({
      where: { id: source.id },
      data: expect.objectContaining({ lastError: 'Download unavailable', lastDocumentsFound: 1, lastItemsInserted: 0 }),
    });
  });
});