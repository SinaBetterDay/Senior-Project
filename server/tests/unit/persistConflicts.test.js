import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/detection/matchEntity.js", () => ({
  normalizeEntityName: (value) =>
    String(value || "")
      .toLowerCase()
      .trim(),
}));

import { persistConflicts } from "../../src/detection/persistConflicts.js";

describe("persistConflicts", () => {
  it("does not insert a new row when the same conflict is run again", async () => {
    const candidate = {
      politician_id: 1,
      agenda_item_id: 100,
      conflict_type: "real_estate",
      severity: "high",
      rule_reference: "TEST_RULE",
      entity_name: "123 Main Street",
      source_key: "real_estate:123 main st",
    };

    const createMany = vi
      .fn()
      // First run: database inserts the conflict
      .mockResolvedValueOnce({ count: 1 })
      // Second run: skipDuplicates prevents another insert
      .mockResolvedValueOnce({ count: 0 });

    const mockPrisma = {
      conflict: {
        createMany,
      },
    };

    const firstRun = await persistConflicts(
      [candidate],
      { prisma: mockPrisma }
    );

    const secondRun = await persistConflicts(
      [candidate],
      { prisma: mockPrisma }
    );

    expect(firstRun.inserted).toBe(1);
    expect(secondRun.inserted).toBe(0);
    expect(secondRun.skipped).toBe(1);
  });

  it("preserves an existing manual review decision when the same candidate is detected again", async () => {
    const candidate = {
      politicianId: "politician-1",
      agendaItemId: "agenda-1",
      conflictType: "INCOME",
      severity: "MEDIUM",
      ruleReference: "TEST_RULE",
      entityName: "Acme Builders",
      sourceKey: "INCOME:acme builders",
    };
    const reviewedAt = new Date("2026-10-25T12:00:00.000Z");
    const existingConflict = {
      ...candidate,
      id: "conflict-1",
      reviewStatus: "not_applicable",
      reviewNote: "Reviewed; no financial interest in this agenda item.",
      reviewedAt,
    };
    const persistedConflicts = [existingConflict];
    const createMany = vi.fn(async ({ data, skipDuplicates }) => {
      expect(skipDuplicates).toBe(true);
      let count = 0;
      for (const row of data) {
        const duplicate = persistedConflicts.some((existing) => (
          existing.politicianId === row.politicianId
          && existing.agendaItemId === row.agendaItemId
          && existing.conflictType === row.conflictType
          && existing.sourceKey === row.sourceKey
        ));
        if (duplicate && skipDuplicates) continue;
        persistedConflicts.push(row);
        count += 1;
      }
      return { count };
    });
    const mockPrisma = {
      conflict: {
        createMany,
        update: vi.fn(),
        upsert: vi.fn(),
      },
    };

    const result = await persistConflicts([candidate], { prisma: mockPrisma });

    expect(result).toEqual({ inserted: 0, skipped: 1 });
    expect(persistedConflicts).toHaveLength(1);
    expect(persistedConflicts[0]).toMatchObject({
      reviewStatus: "not_applicable",
      reviewNote: "Reviewed; no financial interest in this agenda item.",
      reviewedAt,
    });
    expect(mockPrisma.conflict.update).not.toHaveBeenCalled();
    expect(mockPrisma.conflict.upsert).not.toHaveBeenCalled();
  });
});