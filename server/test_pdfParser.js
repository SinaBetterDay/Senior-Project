import assert from 'assert';
import { splitAgendaText, parsePdfAgenda } from './src/ingestion/pdfParser.js';

function assertAgendaItem(item, expectedNumber, expectedTextFragment) {
  assert.strictEqual(item.item_number, expectedNumber);
  assert.ok(
    item.item_text.toLowerCase().includes(expectedTextFragment.toLowerCase()),
    `Expected item_text to include "${expectedTextFragment}", got "${item.item_text}"`
  );
  assert.strictEqual(item.source_type, 'pdf');
}

async function runTests() {
  const sampleText = `
  City Council Agenda
  1. Public comment
  2) Consent calendar
  Item 3: Approve contract
  Agenda Item 4 - Budget update
  A. Discussion of zoning
`;

  const items = splitAgendaText(sampleText, 'city-123', '2026-04-14');
  assert.strictEqual(items.length, 5);
  assertAgendaItem(items[0], '1', 'Public comment');
  assertAgendaItem(items[1], '2', 'Consent calendar');
  assertAgendaItem(items[2], '3', 'Approve contract');
  assertAgendaItem(items[3], '4', 'Budget update');
  assertAgendaItem(items[4], 'A', 'Discussion of zoning');

  const noMatch = splitAgendaText('This PDF has no recognized agenda item markers.', 'city-123', '2026-04-14');
  assert.strictEqual(noMatch.length, 0);

  const invalidPdfResult = await parsePdfAgenda(Buffer.from('%PDF-1.4\n%âãÏÓ\n'), 'city-123', '2026-04-14');
  assert.deepStrictEqual(invalidPdfResult, []);

  console.log('✅ pdfParser tests passed');
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
