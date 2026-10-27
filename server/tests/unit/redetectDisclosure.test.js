import { describe, expect, it, vi } from 'vitest';
import { redetectDisclosureAgendaItems } from '../../src/detection/redetectDisclosure.js';

describe('redetectDisclosureAgendaItems', () => {
  it('detects only agenda items in the politician jurisdiction and filing year', async () => {
    const prisma = {
      politician: { findUnique: vi.fn().mockResolvedValue({ jurisdictionId: 'jurisdiction-1', jurisdiction: { name: 'Test City' } }) },
      agendaItem: { findMany: vi.fn().mockResolvedValue([{ id: 'agenda-1' }, { id: 'agenda-2' }]) },
    };
    const detect = vi.fn().mockResolvedValue({ inserted: 1, skipped: 1, totalCandidates: 2 });

    const result = await redetectDisclosureAgendaItems({ politicianId: 'politician-1', filingYear: 2026, prisma, detect });

    expect(prisma.agendaItem.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { meetingDate: { gte: new Date('2026-01-01T00:00:00.000Z'), lt: new Date('2027-01-01T00:00:00.000Z') }, cityName: 'Test City' },
          { meeting: { is: { jurisdictionId: 'jurisdiction-1', meetingDate: { gte: new Date('2026-01-01T00:00:00.000Z'), lt: new Date('2027-01-01T00:00:00.000Z') } } } },
        ],
      },
      select: { id: true },
    });
    expect(detect).toHaveBeenCalledWith(['agenda-1', 'agenda-2'], { prisma });
    expect(result).toMatchObject({ agendaItemsProcessed: 2, conflictCandidates: 2, conflictsDetected: 1, conflictsSkipped: 1 });
  });

  it('does not scan agenda data when jurisdiction is unresolved', async () => {
    const prisma = {
      politician: { findUnique: vi.fn().mockResolvedValue({ jurisdictionId: null, jurisdiction: null }) },
      agendaItem: { findMany: vi.fn() },
    };
    const detect = vi.fn();

    const result = await redetectDisclosureAgendaItems({ politicianId: 'politician-1', filingYear: 2026, prisma, detect });

    expect(prisma.agendaItem.findMany).not.toHaveBeenCalled();
    expect(detect).not.toHaveBeenCalled();
    expect(result.skippedReason).toBe('politician_jurisdiction_unresolved');
  });

  it('returns retryable failure details without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const prisma = {
      politician: { findUnique: vi.fn().mockResolvedValue({ jurisdictionId: 'jurisdiction-1', jurisdiction: { name: 'Test City' } }) },
      agendaItem: { findMany: vi.fn().mockResolvedValue([{ id: 'agenda-1' }]) },
    };
    const result = await redetectDisclosureAgendaItems({
      politicianId: 'politician-1', filingYear: 2026, prisma,
      detect: vi.fn().mockRejectedValue(new Error('temporary detector failure')),
    });
    expect(result.detectionErrors).toEqual([{ agendaItemIds: ['agenda-1'], message: 'temporary detector failure' }]);
  });
});