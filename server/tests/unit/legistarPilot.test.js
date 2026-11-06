import { describe, expect, it, vi } from 'vitest';
import { fetchPilotPdf, findPilotMentions, runLegistarPilot, selectPilotSample } from '../../src/ingestion/legistarPilot.js';

const filings = [{ filer_name: 'Test Filer', office_title: 'Supervisor', agency: 'County of Sonoma', filing_year: 2019,
  schedules: { A: [{ entity_name: 'Acme Inc.' }, { entity_name: 'Cat' }], B: [{ property_description: '123 First Street', city: 'Sonoma' }] } }];
const item = { EventItemId: 1, EventItemMatterId: 10, EventItemVersion: '1', EventItemTitle: 'Authorize services' };
function dependencies() {
  return {
    getMeetings: vi.fn().mockResolvedValue([{ EventId: 2, EventDate: '2019-06-01', EventBodyName: 'Board', EventInSiteURL: 'https://sonoma-county.legistar.com/meeting' }]),
    getAgendaItems: vi.fn().mockResolvedValue([item]),
    getMatterVersions: vi.fn().mockResolvedValue([{ Key: '99', Value: '1' }, { Key: '100', Value: '2' }]),
    getMatterText: vi.fn().mockResolvedValue({ MatterTextId: 99, MatterTextMatterId: 10, MatterTextVersion: '1', MatterTextPlain: 'Agreement with Acme Inc. for $25,000.' }),
    getMatterAttachments: vi.fn().mockResolvedValue([{ MatterAttachmentId: 3, MatterAttachmentName: 'Summary Report', MatterAttachmentMatterVersion: '0', MatterAttachmentHyperlink: 'https://sonoma-county.legistar1.com/file.pdf' }]),
    fetchPilotPdf: vi.fn().mockResolvedValue({ sha256: 'digest', bytes: 123, pages: [{ page: 2, text: 'Acme agreement' }] }),
  };
}
const options = { filings, startDate: '2019-01-01', endDate: '2019-12-31', maxMatters: 3, maxPdfs: 2 };

describe('Sonoma research pilot', () => {
  it('uses bounded deterministic sampling across the window', () => {
    expect(selectPilotSample([1, 2, 3, 4, 5, 6], 3)).toEqual([1, 3, 5]);
    expect(() => selectPilotSample([], 0)).toThrow('positive');
    expect(() => selectPilotSample([], NaN)).toThrow('positive');
  });

  it('requires whole phrases, excludes city-only/property proximity and short names', () => {
    expect(findPilotMentions(filings, { text: 'Acmeology and cats in Sonoma' })).toEqual([]);
    const result = findPilotMentions(filings, { text: 'Unsuccessful bidder: ACME, Inc.', page: 3, url: 'source' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ entity: 'Acme Inc.', role: 'unverified', status: 'research_mention_not_conflict', evidence: { page: 3, url: 'source' } });
    expect(result[0].evidence).not.toHaveProperty('text', expect.any(String));
  });

  it('compares the same sampled items and preserves version/page evidence without alert writes', async () => {
    const deps = dependencies();
    const result = await runLegistarPilot(options, deps);
    expect(deps.getMatterText).toHaveBeenCalledExactlyOnceWith(expect.any(String), 10, '99');
    expect(result.comparison).toMatchObject({ agendaPairs: 0, enrichedPairs: 1, additionalPairs: 1, unionPairs: 1, pdfsParsed: 1 });
    expect(result.mentions.find(m => m.evidence.page === 2)).toMatchObject({ evidence: { sha256: 'digest', version: '0' } });
    expect(result.documents.find(d => d.layer === 'attachment').versionCaution).toContain('historical');
    expect(result.documents.find(d => d.layer === 'matter_text')).toMatchObject({ text: 'Agreement with Acme Inc. for $25,000.', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(result.documents.find(d => d.layer === 'attachment').pageTexts).toEqual([{ page: 2, text: 'Acme agreement' }]);
    expect(result.mode).toBe('research_only_no_database_writes');
  });

  it('does not substitute newer text for missing historical versions and reports PDF failures', async () => {
    const deps = dependencies();
    deps.getMatterVersions.mockResolvedValue([{ Key: '100', Value: '2' }]);
    deps.fetchPilotPdf.mockRejectedValue(new Error('Not a PDF'));
    const result = await runLegistarPilot(options, deps);
    expect(deps.getMatterText).not.toHaveBeenCalled();
    expect(result.errors.map(e => e.stage)).toEqual(['text_version_unresolved', 'pdf']);
    expect(result.documents[0].status).toBe('failed');
  });

  it('keeps empty and failed upstream meetings distinct from no matches', async () => {
    const deps = dependencies();
    deps.getMeetings.mockResolvedValue([{ EventId: 1 }, { EventId: 2 }, { EventId: 3, EventAgendaStatusName: 'Hidden' }]);
    deps.getAgendaItems.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('upstream unavailable'));
    const result = await runLegistarPilot(options, deps);
    expect(result.meetings.map(m => m.status)).toEqual(['empty_upstream_not_no_conflicts', 'failed']);
    expect(result.errors[0].stage).toBe('event_items');
  });

  it('counts baseline pairs only for enriched sampled items and reports omitted matters', async () => {
    const deps = dependencies();
    deps.getAgendaItems.mockResolvedValue([item, { ...item, EventItemId: 4, EventItemMatterId: 11, EventItemTitle: 'Acme services' }]);
    const result = await runLegistarPilot({ ...options, maxMatters: 1 }, deps);
    expect(result.coverage.omittedMatters).toBe(1);
    expect(result.comparison.agendaPairs).toBe(0);
    expect(result.comparison.additionalPairs).toBe(1);
  });

  it('rejects non-Sonoma disclosures and missing dates', async () => {
    await expect(runLegistarPilot({ ...options, filings: [{ agency: 'Other' }] })).rejects.toThrow('Sonoma');
    await expect(runLegistarPilot({ ...options, startDate: undefined })).rejects.toThrow('dates');
    await expect(runLegistarPilot({ ...options, startDate: '2019-02-31' })).rejects.toThrow('dates');
  });
});

describe('bounded allowlisted PDF extraction', () => {
  const url = 'https://sonoma-county.legistar1.com/report.pdf';
  const parsePdf = vi.fn(async (buffer, options) => { await options.pagerender({ pageNumber: 1, getTextContent: async () => ({ items: [{ str: 'Report text' }] }) }); });
  it('preserves per-page text, bytes and content hash', async () => {
    const result = await fetchPilotPdf(url, { fetchImpl: async () => new Response('%PDF-1.7 contents'), parsePdf });
    expect(result.pages).toEqual([{ page: 1, text: 'Report text' }]);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('blocks off-domain requests and redirect targets before fetching them', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/secret' } }));
    await expect(fetchPilotPdf('https://evil.test/file', { fetchImpl })).rejects.toThrow('allowlist');
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(fetchPilotPdf(url, { fetchImpl })).rejects.toThrow('allowlist');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized, non-PDF, inaccessible and image-only documents', async () => {
    await expect(fetchPilotPdf(url, { maxBytes: 4, fetchImpl: async () => new Response('%PDF-123') })).rejects.toThrow('size');
    await expect(fetchPilotPdf(url, { fetchImpl: async () => new Response('<html>error</html>') })).rejects.toThrow('Not a PDF');
    await expect(fetchPilotPdf(url, { fetchImpl: async () => new Response(null, { status: 410 }) })).rejects.toThrow('410');
    await expect(fetchPilotPdf(url, { fetchImpl: async () => new Response('%PDF-empty'), parsePdf: async () => {} })).rejects.toThrow('OCR');
  });
});