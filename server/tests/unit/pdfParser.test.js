import { describe, it, expect } from 'vitest';
import { splitAgendaText, parsePdfAgenda } from '../../src/ingestion/pdfParser.js';

function expectAgendaItem(item, expectedNumber, expectedTextFragment) {
  expect(item.item_number).toBe(expectedNumber);
  expect(item.item_text.toLowerCase()).toContain(expectedTextFragment.toLowerCase());
  expect(item.source_type).toBe('pdf');
}

describe('splitAgendaText', () => {
  it('splits numbered, lettered, and "Item N" style headers into agenda items', () => {
    const sampleText = `
  City Council Agenda
  1. Public comment
  2) Consent calendar
  Item 3: Approve contract
  Agenda Item 4 - Budget update
  A. Discussion of zoning
`;

    const items = splitAgendaText(sampleText, 'city-123', '2026-04-14');

    expect(items).toHaveLength(5);
    expectAgendaItem(items[0], '1', 'Public comment');
    expectAgendaItem(items[1], '2', 'Consent calendar');
    expectAgendaItem(items[2], '3', 'Approve contract');
    expectAgendaItem(items[3], '4', 'Budget update');
    expectAgendaItem(items[4], 'A', 'Discussion of zoning');
  });

  it('tags every item with the supplied city_id and meeting_date', () => {
    const items = splitAgendaText('1. Roll call\n2. Adjourn', 'city-123', '2026-04-14');

    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.city_id).toBe('city-123');
      expect(item.meeting_date).toBe('2026-04-14');
    }
  });

  it('returns an empty array when no agenda item markers are present', () => {
    const noMatch = splitAgendaText(
      'This PDF has no recognized agenda item markers.',
      'city-123',
      '2026-04-14',
    );

    expect(noMatch).toEqual([]);
  });
});

describe('parsePdfAgenda', () => {
  it('returns an empty array for a truncated/invalid PDF buffer', async () => {
    const invalidPdfResult = await parsePdfAgenda(
      Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
      'city-123',
      '2026-04-14',
    );

    expect(invalidPdfResult).toEqual([]);
  });

  it('returns an empty array when required arguments are missing', async () => {
    await expect(parsePdfAgenda(null, 'city-123', '2026-04-14')).resolves.toEqual([]);
    await expect(parsePdfAgenda(Buffer.from('x'), null, '2026-04-14')).resolves.toEqual([]);
    await expect(parsePdfAgenda(Buffer.from('x'), 'city-123', null)).resolves.toEqual([]);
  });
});
