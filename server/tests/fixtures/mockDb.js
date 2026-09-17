import { vi } from "vitest";

export function createMockPrisma({
  agendaItems = [],
  scheduleB = [],
  scheduleCde = [],
  scheduleA2 = [],
} = {}) {
  const insertedConflicts = [];

  return {
    agendaItem: {
      findMany: vi.fn().mockResolvedValue(agendaItems),
    },

    scheduleBRealEstate: {
      findMany: vi.fn().mockResolvedValue(scheduleB),
    },

    scheduleCdeIncome: {
      findMany: vi.fn().mockResolvedValue(scheduleCde),
    },

    scheduleA2BusinessPosition: {
      findMany: vi.fn().mockResolvedValue(scheduleA2),
    },

    conflict: {
      createMany: vi.fn(async ({ data, skipDuplicates }) => {
        let inserted = 0;

        for (const row of data) {
          const duplicate = insertedConflicts.some(
            (existing) =>
              existing.politicianId === row.politicianId &&
              existing.agendaItemId === row.agendaItemId &&
              existing.conflictType === row.conflictType &&
              existing.sourceKey === row.sourceKey,
          );

          if (duplicate && skipDuplicates) {
            continue;
          }

          insertedConflicts.push(row);
          inserted += 1;
        }

        return { count: inserted };
      }),
    },

    __insertedConflicts: insertedConflicts,
  };
}