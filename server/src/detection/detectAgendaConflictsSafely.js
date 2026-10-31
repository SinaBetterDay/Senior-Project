export async function detectAgendaConflictsSafely(
  agendaItemIds,
  detector,
  dependencies,
) {
  if (agendaItemIds.length === 0) {
    return {
      conflictCandidates: 0,
      conflictsDetected: 0,
      conflictsSkipped: 0,
      detectionErrors: [],
    };
  }

  try {
    const result = await detector(agendaItemIds, dependencies);
    return {
      conflictCandidates: result.totalCandidates ?? 0,
      conflictsDetected: result.inserted ?? 0,
      conflictsSkipped: result.skipped ?? 0,
      detectionErrors: [],
    };
  } catch (error) {
    const detail = {
      agendaItemIds,
      message: error instanceof Error ? error.message : String(error),
    };
    console.error('[conflicts] agenda detection failed:', detail);
    return {
      conflictCandidates: 0,
      conflictsDetected: 0,
      conflictsSkipped: 0,
      detectionErrors: [detail],
    };
  }
}

export function getRetryableAgendaItemIds(detectionErrors) {
  if (!Array.isArray(detectionErrors)) return [];
  return [...new Set(detectionErrors.flatMap((error) => (
    Array.isArray(error?.agendaItemIds)
      ? error.agendaItemIds.filter((id) => typeof id === 'string' && id.length > 0)
      : []
  )))];
}
