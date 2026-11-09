import { detectAgendaConflictsSafely } from './detectAgendaConflictsSafely.js';
import { detectConflictsForAgendaItems } from './detectConflicts.js';

function filingYearRange(filingYear) {
  return {
    gte: new Date(Date.UTC(filingYear, 0, 1)),
    lt: new Date(Date.UTC(filingYear + 1, 0, 1)),
  };
}

export async function redetectDisclosureAgendaItems({
  politicianId,
  filingYear,
  prisma,
  detect = detectConflictsForAgendaItems,
}) {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: {
      jurisdictionId: true,
      jurisdiction: { select: { name: true } },
    },
  });
  const jurisdictionName = politician?.jurisdiction?.name?.trim();

  if (!politician?.jurisdictionId || !jurisdictionName) {
    return {
      agendaItemsProcessed: 0,
      conflictCandidates: 0,
      conflictsDetected: 0,
      conflictsSkipped: 0,
      detectionErrors: [],
      skippedReason: 'politician_jurisdiction_unresolved',
    };
  }

  const dateRange = filingYearRange(filingYear);
  const agendaItems = await prisma.agendaItem.findMany({
    where: {
      OR: [
        { meetingDate: dateRange, cityName: jurisdictionName },
        {
          meeting: {
            is: {
              jurisdictionId: politician.jurisdictionId,
              meetingDate: dateRange,
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  const agendaItemIds = agendaItems.map(({ id }) => id);
  const detection = await detectAgendaConflictsSafely(
    agendaItemIds,
    detect,
    { prisma },
  );

  return {
    agendaItemsProcessed: agendaItemIds.length,
    ...detection,
    skippedReason: null,
  };
}

export default redetectDisclosureAgendaItems;