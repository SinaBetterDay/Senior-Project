// Small, generated text PDFs exercise real pdf-parse without storing a person's
// disclosure or requiring a developer's Downloads directory in the test suite.
export const pdfItem = (text, x, y) => ({ text, x, y });
export const pdfCover = [
  pdfItem('CALIFORNIA FORM 700', 40, 750), pdfItem('COVER PAGE', 290, 720),
  pdfItem('(LAST)', 122, 692), pdfItem('(FIRST)', 254, 692), pdfItem('(MIDDLE)', 398, 692),
  pdfItem('Example', 114, 676), pdfItem('Alex', 291, 676), pdfItem('A', 460, 676),
  pdfItem('Agency Name', 51, 640), pdfItem('County of Test', 53, 625),
  pdfItem('Your Position', 334, 611), pdfItem('Supervisor', 337, 595),
  pdfItem('Annual: January 1, 2025, through', 66, 426), pdfItem('December 31, 2025.', 99, 415),
  pdfItem('FPPC Form 700 (2025/2026)', 400, 37),
  pdfItem('Filed Date: 04/01/2026', 421, 724),
  // These are summary options, NOT schedule page headings.
  pdfItem('Schedule A-1 - Investments - schedule attached', 77, 278),
];

export function makeForm700Pdf(pages = [pdfCover]) {
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const refs = [];
  for (const items of pages) {
    const pageId = objects.length;
    const streamId = pageId + 1;
    refs.push(`${pageId} 0 R`);
    const stream = items.map(({ text, x, y }) => `BT /F1 10 Tf ${x} ${y} Td (${text.replace(/[\\()]/g, '\\$&')}) Tj ET`).join('\n') + '\n';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  }
  objects[2] = `<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${pages.length} >>`;
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(output));
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}