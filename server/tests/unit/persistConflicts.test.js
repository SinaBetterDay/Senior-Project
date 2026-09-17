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
});