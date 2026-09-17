import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/detection/matchEntity.js", () => ({
  getAgendaText: (item = {}) =>
    [item.item_text, item.itemText, item.description, item.title]
      .filter((value) => value != null && String(value).trim() !== "")
      .join("\n"),

  pickField: (row, ...keys) => {
    if (!row) return undefined;

    for (const key of keys) {
      if (row[key] != null && row[key] !== "") {
        return row[key];
      }
    }

    return undefined;
  },
}));

import { detectRealEstate } from "../../src/detection/detectRealEstate.js";

import {
  matchingProperty,
  matchingAgendaItem,
  nonMatchingAgendaItem,
  weakMatchAgendaItem,
} from "../fixtures/realEstateFixtures.js";

describe("detectRealEstate", () => {
  it("flags a correct property address match", async () => {
    const result = await detectRealEstate(
      [matchingProperty],
      matchingAgendaItem
    );

    expect(result).toHaveLength(1);
  });

  it("does not flag a property when the agenda item does not match", async () => {
  const result = await detectRealEstate(
    [matchingProperty],
    nonMatchingAgendaItem
  );

  expect(result).toHaveLength(0);
});

it("does not flag a weak partial property match", async () => {
  const result = await detectRealEstate(
    [matchingProperty],
    weakMatchAgendaItem
  );

  expect(result).toHaveLength(0);
});

});