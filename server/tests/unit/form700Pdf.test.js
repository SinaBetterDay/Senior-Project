import { describe, expect, it } from 'vitest';
import { parseForm700Pdf, parseForm700PdfPages } from '../../src/parsers/form700Pdf.js';
import { makeForm700Pdf, pdfCover, pdfItem } from '../fixtures/form700Pdf.js';

describe('text-based FPPC Form 700 PDFs', () => {
  it('reads real PDF bytes using the reporting year, not the filed or template year', async () => {
    const result = await parseForm700Pdf(makeForm700Pdf());
    expect(result.cover).toEqual({ filer_name: 'Alex A Example', agency: 'County of Test', office_title: 'Supervisor', district: null, filing_year: 2025 });
    expect(result.schedules).toEqual({ A: [], A2: [], B: [], CDE: [] });
    expect(result.warnings[0]).toContain('no financial schedule pages');
  });

  it('warns on amendments and ignores cover attachments', () => {
    const result = parseForm700PdfPages([[...pdfCover, pdfItem('AMENDMENT', 60, 718)], [pdfItem('COVER PAGE ATTACHMENT', 40, 720), pdfItem('Name', 40, 690), pdfItem('Alex Example', 40, 675)]]);
    expect(result.warnings).toContain('This is an amendment. Missing schedules are not carried forward from earlier filings.');
  });

  it('reads named entities and properties from separate schedule pages and columns', async () => {
    const pages = [pdfCover];
    for (const type of ['A-1', 'A-2', 'B', 'C', 'D', 'E']) {
      const label = type.startsWith('A') ? 'NAME OF BUSINESS ENTITY' : type === 'B' ? 'STREET ADDRESS OR PRECISE LOCATION' : 'NAME OF SOURCE';
      pages.push([pdfItem(`SCHEDULE ${type}`, 40, 720), pdfItem(label, 40, 650), pdfItem(`${type} Entity`, 40, 635), pdfItem(label, 320, 650), pdfItem(`${type} Other`, 320, 635)]);
    }
    const result = await parseForm700Pdf(makeForm700Pdf(pages));
    expect(result.schedules.A.map(row => row.entity_name)).toEqual(['A-1 Entity', 'A-1 Other']);
    expect(result.schedules.A2).toHaveLength(2);
    expect(result.schedules.B[0].property_description).toBe('B Entity');
    expect(result.schedules.CDE.map(row => row.schedule_type)).toEqual(['C', 'C', 'D', 'D', 'E', 'E']);
    expect(result.warnings[0]).toContain('named entities');
  });

  it('rejects scanned, non-Form-700, malformed and mislabeled inputs', async () => {
    await expect(parseForm700Pdf(makeForm700Pdf([[]]))).rejects.toThrow('Scanned PDFs');
    await expect(parseForm700Pdf(Buffer.from('not a PDF'))).rejects.toThrow('not a valid PDF');
    await expect(parseForm700Pdf(Buffer.from('%PDF-broken'))).rejects.toThrow('Could not read');
    expect(() => parseForm700PdfPages([[pdfItem('COVER PAGE', 40, 720)]])).toThrow('filer name and reporting year');
  });

  it('fails closed for unreadable schedules rather than silently importing zero records', () => {
    expect(() => parseForm700PdfPages([pdfCover, [pdfItem('SCHEDULE C', 40, 720), pdfItem('NAME OF SOURCE', 40, 650), pdfItem('BUSINESS ACTIVITY', 40, 635)]])).toThrow('Could not safely read PDF Schedule C');
  });
});