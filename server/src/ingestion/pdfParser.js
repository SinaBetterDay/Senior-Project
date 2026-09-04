import dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

// Load local server environment if available.
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)
  : null;

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function buildAgendaItems(rawText, cityId, meetingDate) {
  const normalized = normalizeText(rawText);
  const sectionRegex = /^\s*(?:agenda\s*item\s*|item\s*)?([0-9]{1,3}|[A-Za-z])\s*(?:[.)\-:])\s*/gim;

  const matches = [];
  let match;
  while ((match = sectionRegex.exec(normalized)) !== null) {
    matches.push({
      index: match.index,
      itemNumber: match[1].trim(),
      headerLength: match[0].length,
    });
  }

  if (matches.length === 0) {
    return [];
  }

  return matches.map((current, index) => {
    const next = matches[index + 1];
    const start = current.index + current.headerLength;
    const end = next ? next.index : normalized.length;
    const itemText = normalized.slice(start, end).trim();

    return {
      city_id: cityId,
      meeting_date: meetingDate,
      item_number: current.itemNumber,
      item_text: itemText || normalized.slice(current.index, end).trim(),
      source_type: 'pdf',
    };
  });
}

async function insertAgendaItems(items) {
  if (!supabase) {
    console.warn('Supabase config missing or incomplete; agenda items will not be saved.');
    return items;
  }

  if (items.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('agenda_items')
    .insert(items)
    .select('*');

  if (error) {
    console.error('Supabase insert failed:', error.message || error);
    throw error;
  }

  return data ?? items;
}

export function splitAgendaText(rawText, cityId, meetingDate) {
  return buildAgendaItems(rawText, cityId, meetingDate);
}

export async function parsePdfAgenda(pdfBuffer, cityId, meetingDate) {
  if (!pdfBuffer || !cityId || !meetingDate) {
    return [];
  }

  let parsed;
  try {
    parsed = await pdfParse(pdfBuffer);
  } catch (error) {
    console.warn('Warning: PDF could not be parsed.', error?.message || error);
    return [];
  }

  const rawText = normalizeText(parsed?.text);
  if (!rawText) {
    console.warn('Warning: PDF did not contain extractable text.');
    return [];
  }

  const items = buildAgendaItems(rawText, cityId, meetingDate);
  const rows = items.length > 0
    ? items
    : [{
      city_id: cityId,
      meeting_date: meetingDate,
      item_number: 'unparsed',
      item_text: rawText,
      source_type: 'pdf',
    }];

  return await insertAgendaItems(rows);
}
