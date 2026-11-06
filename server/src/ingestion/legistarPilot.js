import { createHash } from 'node:crypto';
import pdfParse from 'pdf-parse';
import { getMeetings, getAgendaItems, getMatterVersions, getMatterText, getMatterAttachments } from './legistarApi.js';
import { normalizeEntityName } from '../utils/entityNorm.js';
import { collapseText } from '../detection/matchEntity.js';

const BASE = 'https://webapi.legistar.com/v1/sonoma-county';
const MAX_BYTES = 20 * 1024 * 1024;

export function selectPilotSample(values, limit) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Sample limit must be a positive integer');
  if (values.length <= limit) return values;
  return Array.from({ length: limit }, (_, index) => values[Math.floor(index * values.length / limit)]);
}

export function findPilotMentions(filings, document) {
  const text = collapseText(document.text);
  const mentions = [];
  for (const filing of filings) for (const [schedule, rows] of Object.entries(filing.schedules)) {
    for (const [index, row] of rows.entries()) {
      // No city-only property matches, aliases, fuzzy resolution or LLM calls.
      const name = row.entity_name ?? row.source_name ?? row.property_description;
      const needle = normalizeEntityName(name);
      if (!needle || needle.length < 4) continue;
      const offset = (` ${text} `).indexOf(` ${needle} `);
      if (offset < 0) continue;
      mentions.push({ filer: filing.filer_name, office: filing.office_title, filingYear: filing.filing_year, schedule,
        disclosureIndex: index, entity: name, disclosure: row,
        method: 'normalized_phrase_only', role: 'unverified', status: 'research_mention_not_conflict',
        caution: 'Name occurrence only; entity identity, financial relevance, authority, participation and reporting period require review.',
        ambiguousShortName: needle.split(' ').length === 1,
        evidence: { ...document, text: undefined, normalizedExcerpt: text.slice(Math.max(0, offset - 180), offset + needle.length + 220) } });
    }
  }
  return mentions;
}

export async function fetchPilotPdf(url, { fetchImpl = fetch, parsePdf = pdfParse, maxBytes = MAX_BYTES } = {}) {
  const validate = value => {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      !['sonoma-county.legistar.com', 'sonoma-county.legistar1.com'].includes(parsed.hostname) || parsed.port) {
      throw new Error('PDF URL is outside the Sonoma Legistar allowlist');
    }
    return parsed.href;
  };
  let current = validate(url);
  let response;
  const signal = AbortSignal.timeout(30000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    response = await fetchImpl(current, { redirect: 'manual', signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    await response.body?.cancel();
    if (redirects === 3) throw new Error('Too many PDF redirects');
    current = validate(new URL(response.headers.get('location'), current).href);
  }
  if (!response.ok) throw new Error(`PDF download HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Error('PDF exceeds size limit'); }
  if (!response.body) throw new Error('PDF response has no body');
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('PDF exceeds size limit'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  const buffer = Buffer.concat(chunks);
  if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('Not a PDF');
  const pages = [];
  await parsePdf(buffer, { pagerender: async page => {
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pages.push({ page: page.pageNumber, text });
    return text;
  } });
  if (!pages.some(page => page.text.trim())) throw new Error('PDF has no extractable text (OCR not implemented)');
  return { url: current, sha256: createHash('sha256').update(buffer).digest('hex'), bytes: size, pages };
}

export async function runLegistarPilot({ filings, startDate, endDate, maxMatters = 200, maxPdfs = 40, log = () => {} }, deps = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate ||
    !Number.isFinite(Date.parse(startDate)) || !Number.isFinite(Date.parse(endDate)) ||
    new Date(startDate).toISOString().slice(0, 10) !== startDate || new Date(endDate).toISOString().slice(0, 10) !== endDate) throw new Error('Explicit valid start/end dates required');
  if (!filings?.length || filings.some(f => !/^(county of sonoma|sonoma county)$/i.test(f.agency))) throw new Error('Pilot accepts only Sonoma disclosures');
  selectPilotSample([], maxMatters);
  selectPilotSample([], maxPdfs);
  const api = { getMeetings, getAgendaItems, getMatterVersions, getMatterText, getMatterAttachments, fetchPilotPdf, ...deps };
  const report = { source: BASE, startDate, endDate, generatedAt: new Date().toISOString(), mode: 'research_only_no_database_writes',
    periodStatus: 'unverified_historical_comparison_not_legal_eligibility', meetings: [], items: [], documents: [], mentions: [], errors: [], comparison: {} };
  const meetings = await api.getMeetings(BASE, { startDate, endDate });
  const matters = new Map();
  for (const meeting of meetings) {
    if (String(meeting.EventAgendaStatusName).toLowerCase() === 'hidden' || /^test\b/i.test(meeting.EventComment ?? '')) continue;
    const summary = { id: meeting.EventId, date: meeting.EventDate, body: meeting.EventBodyName, url: meeting.EventInSiteURL };
    report.meetings.push(summary);
    try {
      const items = await api.getAgendaItems(BASE, meeting.EventId);
      summary.items = items.length;
      summary.status = items.length ? 'available' : 'empty_upstream_not_no_conflicts';
      for (const item of items) {
        const context = { eventId: meeting.EventId, meetingDate: meeting.EventDate, body: meeting.EventBodyName, itemId: item.EventItemId,
          matterId: item.EventItemMatterId, itemVersion: item.EventItemVersion, title: item.EventItemTitle, url: meeting.EventInSiteURL };
        report.items.push(context);
        const doc = { ...context, layer: 'agenda', retrievedAt: new Date().toISOString(), text: [item.EventItemTitle, item.EventItemAgendaNote].filter(Boolean).join('\n') };
        report.mentions.push(...findPilotMentions(filings, doc));
        if (context.matterId) {
          if (!matters.has(context.matterId)) matters.set(context.matterId, []);
          matters.get(context.matterId).push(context);
        }
      }
    } catch (error) { summary.status = 'failed'; report.errors.push({ stage: 'event_items', eventId: meeting.EventId, error: error.message }); }
  }
  const sampled = selectPilotSample([...matters.entries()], maxMatters);
  report.coverage = { meetingsFound: meetings.length, uniqueMatters: matters.size, sampledMatters: sampled.length, omittedMatters: matters.size - sampled.length,
    sampling: 'deterministic_even_spacing_in_meeting_order', maxPdfs };
  const pdfCandidates = [];
  for (let index = 0; index < sampled.length; index += 4) {
    await Promise.all(sampled.slice(index, index + 4).map(async ([matterId, contexts]) => {
      log(`Matter ${matterId}`);
      let versions = [];
      try { versions = await api.getMatterVersions(BASE, matterId); }
      catch (error) { report.errors.push({ stage: 'versions', matterId, error: error.message }); }
      // Never silently substitute the latest version for a historical event.
      const requested = new Set(contexts.map(c => String(c.itemVersion ?? '')));
      const selected = versions.filter(v => requested.has(String(v.Value)));
      for (const context of contexts) if (!versions.some(v => String(v.Value) === String(context.itemVersion ?? ''))) {
        report.errors.push({ stage: 'text_version_unresolved', matterId, itemId: context.itemId, version: context.itemVersion });
      }
      for (const version of selected) {
        try {
          const data = await api.getMatterText(BASE, matterId, version.Key);
          if (Number(data.MatterTextMatterId) !== Number(matterId) || String(data.MatterTextVersion) !== String(version.Value)) throw new Error('Matter text identity/version mismatch');
          const document = { layer: 'matter_text', matterId, textId: data.MatterTextId, version: data.MatterTextVersion,
            modifiedAt: data.MatterTextLastModifiedUtc, retrievedAt: new Date().toISOString(), url: `${BASE}/Matters/${matterId}/Texts/${version.Key}`, text: data.MatterTextPlain ?? '' };
          if (!document.text.trim()) throw new Error('Matter text is empty');
          report.documents.push({ ...document, characters: document.text.length,
            sha256: createHash('sha256').update(document.text).digest('hex') });
          for (const context of contexts.filter(c => String(c.itemVersion) === String(version.Value))) report.mentions.push(...findPilotMentions(filings, { ...context, ...document }));
        } catch (error) { report.errors.push({ stage: 'matter_text', matterId, error: error.message }); }
      }
      try {
        const attachments = await api.getMatterAttachments(BASE, matterId);
        for (const a of attachments) {
          const document = { layer: 'attachment', matterId, attachmentId: a.MatterAttachmentId, name: a.MatterAttachmentName,
            version: a.MatterAttachmentMatterVersion, modifiedAt: a.MatterAttachmentLastModifiedUtc, url: a.MatterAttachmentHyperlink,
            retrievedAt: new Date().toISOString(), versionCaution: 'Retrieved current attachment; version 0/unversioned and modification date do not establish availability at historical meeting.' };
          report.documents.push({ ...document, status: 'discovered_not_fetched' });
          if (a.MatterAttachmentShowOnInternetPage !== false && /\.pdf(?:$|\?)/i.test(document.url ?? '')) pdfCandidates.push({ document, contexts });
        }
      } catch (error) { report.errors.push({ stage: 'attachments', matterId, error: error.message }); }
    }));
  }
  // Prefer staff/summary reports, then agreements. All omissions are explicit.
  pdfCandidates.sort((a, b) => {
    const priority = x => /staff|summary|board.*(report|letter)/i.test(x.document.name) ? 0 : /agreement|contract|amendment/i.test(x.document.name) ? 1 : 2;
    return priority(a) - priority(b) || a.document.matterId - b.document.matterId || a.document.attachmentId - b.document.attachmentId;
  });
  const unique = [...new Map(pdfCandidates.map(c => [c.document.url, c])).values()];
  report.coverage.pdfCandidates = unique.length;
  report.coverage.pdfsAttempted = Math.min(maxPdfs, unique.length);
  report.coverage.pdfsOmittedByLimit = Math.max(0, unique.length - maxPdfs);
  for (const { document, contexts } of unique.slice(0, maxPdfs)) {
    const stored = report.documents.find(d => d.attachmentId === document.attachmentId && d.matterId === document.matterId);
    try {
      const pdf = await api.fetchPilotPdf(document.url);
      Object.assign(stored, { status: 'parsed', sha256: pdf.sha256, bytes: pdf.bytes, pages: pdf.pages.length, pageTexts: pdf.pages, finalUrl: pdf.url });
      for (const context of contexts) for (const page of pdf.pages) report.mentions.push(...findPilotMentions(filings, { ...context, ...document, ...page, sha256: pdf.sha256 }));
    } catch (error) { stored.status = 'failed'; stored.error = error.message; report.errors.push({ stage: 'pdf', url: document.url, error: error.message }); }
  }
  const key = m => JSON.stringify([m.filer, m.schedule, m.disclosureIndex, m.evidence.itemId]);
  const selectedItems = new Set(sampled.flatMap(([, contexts]) => contexts.map(c => c.itemId)));
  const baseline = new Set(report.mentions.filter(m => m.evidence.layer === 'agenda' && selectedItems.has(m.evidence.itemId)).map(key));
  const enriched = new Set(report.mentions.filter(m => m.evidence.layer !== 'agenda').map(key));
  report.comparison = { scope: 'same sampled matter-linked items; counts are disclosure/item pairs, not conflicts',
    agendaPairs: baseline.size, enrichedPairs: enriched.size, additionalPairs: [...enriched].filter(k => !baseline.has(k)).length,
    unionPairs: new Set([...baseline, ...enriched]).size, pdfsParsed: report.documents.filter(d => d.status === 'parsed').length };
  report.limitations = ['Mentions are not legal conflicts or verified transaction roles; no alerts were persisted.',
    'No fuzzy matching, aliases, OCR, or LLM calls. Short/common names require special scrutiny.',
    'Not all filers are supervisors; Board items do not establish another official’s authority or participation.',
    'Attachment chronology and filing reporting periods remain unverified.', 'Sample limits and unavailable documents preclude a no-conflict conclusion.'];
  return report;
}