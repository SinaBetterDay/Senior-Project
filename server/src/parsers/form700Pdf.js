import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const normalize = value => value.replace(/\s+/g, ' ').trim();

// FPPC fields put their values immediately below their labels. Keep columns
// separate: reading a whole PDF as plain text interleaves unrelated fields.
function below(items, label, width = 250) {
  const candidates = items.filter(item => item.y < label.y - 3 && item.y >= label.y - 24
    && item.x >= label.x - 15 && item.x < label.x + width);
  if (!candidates.length) return null;
  const y = Math.max(...candidates.map(item => item.y));
  return normalize(candidates.filter(item => Math.abs(item.y - y) < 3)
    .sort((a, b) => a.x - b.x).map(item => item.text).join(' ')) || null;
}

/** Parse text items from standard FPPC pages; never infer data from filenames. */
export function parseForm700PdfPages(pages) {
  const coverPage = pages.find(items => items.some(item => /^COVER PAGE$/i.test(item.text)));
  if (!coverPage) throw new Error('PDF must contain a recognizable Form 700 cover page. Scanned PDFs are not supported.');
  const field = (pattern, width) => {
    const label = coverPage.find(item => pattern.test(item.text));
    return label ? below(coverPage, label, width) : null;
  };
  const last = field(/\(LAST\)/i, 145);
  const first = field(/\(FIRST\)/i, 140);
  const middle = field(/\(MIDDLE\)/i, 170);
  const coverText = coverPage.map(item => item.text).join(' ');
  const year = coverText.match(/December\s+31,?\s*((?:19|20)\d{2})/i)
    ?? coverText.match(/January\s+1,?\s*((?:19|20)\d{2})/i);
  const cover = {
    filer_name: first && last ? [first, middle, last].filter(Boolean).join(' ') : null,
    agency: field(/^Agency Name\b/i, 500),
    office_title: field(/^Your(?: Position)?$/i, 250),
    district: null,
    filing_year: year ? Number(year[1]) : null,
  };
  if (!cover.filer_name || !cover.filing_year) {
    throw new Error('Could not safely read the PDF filer name and reporting year. Use a standard text-based FPPC Form 700 or an XLSX export.');
  }
  const schedules = { A: [], A2: [], B: [], CDE: [] };
  const warnings = [];
  let schedulePages = 0;
  for (const items of pages) {
    if (items.some(item => /^COVER PAGE(?: ATTACHMENT)?$/i.test(item.text))) continue;
    const heading = items.find(item => /^SCHEDULE\s+(A[- ]?[12]?|B|C|D|E)\b/i.test(item.text));
    if (!heading) continue;
    schedulePages++;
    const type = heading.text.match(/^SCHEDULE\s+(A[- ]?[12]?|B|C|D|E)\b/i)[1].toUpperCase().replace(/[ -]/g, '');
    const pattern = type.startsWith('A') ? /^NAME OF BUSINESS (?:ENTITY|TRUST)/i
      : type === 'B' ? /^STREET ADDRESS OR PRECISE LOCATION/i : /^NAME OF SOURCE/i;
    const labels = items.filter(item => pattern.test(item.text));
    let count = 0;
    for (const label of labels) {
      const value = below(items, label, 250);
      if (!value) continue;
      // Blank templates and unsupported extraction orders must not become entities.
      if (/^(?:NAME OF|STREET ADDRESS|CITY|FAIR MARKET|BUSINESS ACTIVITY|ADDRESS|NONE\b)/i.test(value)) continue;
      const row = type.startsWith('A') ? { entity_name: value }
        : type === 'B' ? { property_description: value } : { source_name: value, schedule_type: type };
      schedules[type === 'A2' ? 'A2' : type.startsWith('A') ? 'A' : type === 'B' ? 'B' : 'CDE'].push(row);
      count++;
    }
    if (!count) throw new Error(`Could not safely read PDF Schedule ${type}. Use an XLSX export instead; no filing was imported.`);
  }
  if (!schedulePages) warnings.push('This PDF contains no financial schedule pages. Only cover-page metadata and the original PDF are saved; no disclosure records are created.');
  else warnings.push('PDF import extracts named entities and property locations only. Review the original PDF for amounts, interests, business positions and other details; use XLSX for full structured schedule data.');
  if (/\bAMENDMENT\b/i.test(coverText)) warnings.push('This is an amendment. Missing schedules are not carried forward from earlier filings.');
  return { cover, schedules, warnings };
}

export async function parseForm700Pdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('Uploaded file is not a valid PDF.');
  const pages = [];
  try {
    // Give PDF.js an isolated byte array, not a pooled Node Buffer whose backing
    // ArrayBuffer can contain unrelated documents and cause incorrect cache hits.
    await pdfParse(Uint8Array.from(buffer), { pagerender: async page => {
      const content = await page.getTextContent();
      pages.push(content.items.map(item => ({ text: normalize(item.str), x: item.transform[4], y: item.transform[5] })).filter(item => item.text));
      return '';
    } });
  } catch {
    throw new Error('Could not read this PDF. Choose an unencrypted, text-based Form 700 PDF; scanned PDFs are not supported.');
  }
  return parseForm700PdfPages(pages);
}