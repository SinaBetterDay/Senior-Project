import { describe, it, expect } from "vitest";
import { detectBusinessPositions } from "../../src/detection/detectBusinessPositions.js";
import { CONFLICT_TYPES, SEVERITY } from "../../src/config/conflictRules.js";

const politicianId = "pol-a2-1";
const agendaItemId = "item-a2-1";

const position = {
  politician_id: politicianId,
  entity_name: "Riverbank Development LLC",
  business_position: "Managing Member",
};

describe("detectBusinessPositions", () => {
  it("flags when the entity appears in the agenda item", async () => {
    const item = {
      id: agendaItemId,
      title: "Design review for Riverbank Development LLC project",
      description: "Site plan at the riverfront.",
    };

    const flags = await detectBusinessPositions([position], item);

    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      politician_id: politicianId,
      agenda_item_id: agendaItemId,
      conflict_type: CONFLICT_TYPES.BUSINESS_POSITION,
      severity: SEVERITY.MEDIUM,
      entity_name: "Riverbank Development LLC",
    });
    expect(flags[0].rule_reference).toMatch(/§87103\(d\)/);
  });

  it("does not flag a different company", async () => {
    const item = {
      id: agendaItemId,
      title: "Contract with Northstar Paving Inc",
      description: "Resurfacing of arterial streets.",
    };

    const flags = await detectBusinessPositions([position], item);
    expect(flags).toHaveLength(0);
  });

  it("returns no flags and does not throw when the table is empty", async () => {
    const item = {
      id: agendaItemId,
      title: "Design review for Riverbank Development LLC project",
    };

    await expect(detectBusinessPositions([], item)).resolves.toEqual([]);
  });
});
