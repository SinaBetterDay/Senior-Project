import express from 'express';
import prisma from '../lib/prisma.js';
import { normalizeEntityName } from '../utils/entityNorm.js';

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', (_req, res) => {
  res.status(200).json({ data: [], note: 'dashboard list pending SH-44' });
});

const STREET_CANON = [
  [/\b(street|str)\b/g, 'st'], [/\bavenue\b/g, 'ave'],
  [/\bboulevard\b/g, 'blvd'], [/\broad\b/g, 'rd'],
  [/\bdrive\b/g, 'dr'], [/\blane\b/g, 'ln'],
  [/\bcourt\b/g, 'ct'], [/\bplace\b/g, 'pl'],
  [/\bhighway\b/g, 'hwy'], [/\bcircle\b/g, 'cir'],
  [/\bparkway\b/g, 'pkwy'],
];

function canonicalizeLocation(value) {
  let text = String(value || '').toLowerCase().replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  for (const [pattern, replacement] of STREET_CANON) text = text.replace(pattern, replacement);
  return text;
}

function sourceMatches(conflict, label) {
  if (!label) return false;
  if (conflict.conflictType === 'REAL_ESTATE') {
    return conflict.sourceKey === `REAL_ESTATE:${canonicalizeLocation(label) || 'property'}`;
  }
  const fallback = conflict.conflictType === 'INCOME' || conflict.conflictType === 'GIFT' || conflict.conflictType === 'TRAVEL' ? 'source' : 'entity';
  return conflict.sourceKey === `${conflict.conflictType}:${normalizeEntityName(label) || fallback}`;
}

async function findScheduleEntry(conflict) {
  // Imported schedule rows may have no politicianId; their filing still owns the row.
  const where = { OR: [{ politicianId: conflict.politicianId }, { filing: { politicianId: conflict.politicianId } }] };
  const orderBy = { createdAt: 'desc' };
  let rows;
  switch (conflict.conflictType) {
    case 'INVESTMENT':
      rows = await prisma.scheduleAInvestment.findMany({ where, orderBy });
      return formatSchedule(rows.find(row => sourceMatches(conflict, row.entityName)), 'A');
    case 'REAL_ESTATE':
      rows = await prisma.scheduleBRealEstate.findMany({ where, orderBy });
      return formatSchedule(rows.find(row => sourceMatches(conflict, row.propertyDescription) ||
        sourceMatches(conflict, row.city) || sourceMatches(conflict, row.county)), 'B');
    case 'BUSINESS_POSITION':
      rows = await prisma.scheduleA2BusinessPosition.findMany({ where, orderBy });
      return formatSchedule(rows.find(row => sourceMatches(conflict, row.entityName)), 'A-2');
    case 'INCOME':
    case 'GIFT':
    case 'TRAVEL': {
      const scheduleType = { INCOME: 'C', GIFT: 'D', TRAVEL: 'E' }[conflict.conflictType];
      rows = await prisma.scheduleCdeIncome.findMany({ where: { AND: [where, { scheduleType }] }, orderBy });
      return formatSchedule(rows.find(row => sourceMatches(conflict, row.sourceName)), scheduleType);
    }
    default: return null;
  }
}

function formatSchedule(row, scheduleType) {
  if (!row) return null;
  return {
    scheduleType,
    entityName: row.entityName ?? row.sourceName ?? row.propertyDescription ?? null,
    dollarValue: row.fairMarketValue ?? row.amount ?? row.grossIncomeRange ?? null,
    natureOfInterest: row.natureOfInvestment ?? row.natureOfInterest ?? row.businessPosition ?? null,
  };
}

router.get('/:id', async (req, res, next) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Conflict not found' });
  try {
    const conflict = await prisma.conflict.findUnique({
      where: { id: req.params.id },
      include: { politician: true, agendaItem: { include: { meeting: { include: { jurisdiction: true } } } } },
    });
    if (!conflict) return res.status(404).json({ error: 'Conflict not found' });
    const item = conflict.agendaItem;
    const entry = await findScheduleEntry(conflict);
    res.json({ data: {
      id: conflict.id,
      politician: { name: conflict.politician.fullName, district: conflict.politician.district },
      conflictType: conflict.conflictType,
      severity: conflict.severity,
      ruleReference: conflict.ruleReference,
      entityName: conflict.entityName,
      scheduleEntry: entry,
      agendaItem: {
        title: item.title,
        text: item.itemText ?? item.description ?? item.title,
        meetingDate: item.meetingDate ?? item.meeting?.meetingDate ?? null,
        city: item.cityName ?? item.meeting?.jurisdiction?.name ?? null,
      },
    } });
  } catch (error) { next(error); }
});

export default router;
