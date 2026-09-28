import pdfParse from 'pdf-parse';

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
      cityId,
      meetingDate,
      itemNumber: current.itemNumber,
      itemText: itemText || normalized.slice(current.index, end).trim(),
      sourceType: 'pdf',
    };
  });
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
  return items.length > 0
    ? items
    : [{
      cityId,
      meetingDate,
      itemNumber: 'unparsed',
      itemText: rawText,
      sourceType: 'pdf',
    }];
}
