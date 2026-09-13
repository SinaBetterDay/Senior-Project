import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/detection/matchEntity.js", () => ({
  getAgendaText: (item = {}) =>
    [item.item_text, item.itemText, item.description, item.title]
      .filter((value) => value != null && String(value).trim() !== "")
      .join("\n"),

  normalizeEntityName: (value) =>
    String(value || "")
      .toLowerCase()
      .trim(),

  pickField: (row, ...keys) => {
    if (!row) return undefined;

    for (const key of keys) {
      if (row[key] != null && row[key] !== "") {
        return row[key];
      }
    }

    return undefined;
  },

  matchNamedEntity: vi.fn(),
}));

import { detectBusinessPositions } from "../../src/detection/detectBusinessPositions.js";

import {
  matchingBusinessPosition,
  matchingBusinessAgendaItem,
  nonMatchingBusinessAgendaItem,
} from "../fixtures/businessPositionFixtures.js";

describe("detectBusinessPositions", () => {
  it("flags a matching business position", async () => {
    const mockMatcher = vi.fn().mockResolvedValue({
      matched: true,
      score: 0.95,
    });

    const result = await detectBusinessPositions(
      [matchingBusinessPosition],
      matchingBusinessAgendaItem,
      {
        matchNamedEntity: mockMatcher,
      }
    );

    expect(result).toHaveLength(1);
  });

  it("does not flag a business position when the entity does not match", async () => {
  const mockMatcher = vi.fn().mockResolvedValue({
    matched: false,
    score: 0.2,
  });

  const result = await detectBusinessPositions(
    [matchingBusinessPosition],
    nonMatchingBusinessAgendaItem,
    {
      matchNamedEntity: mockMatcher,
    }
  );

  expect(result).toHaveLength(0);
});

it("does not flag a weak business entity match", async () => {
  const mockMatcher = vi.fn().mockResolvedValue({
    matched: false,
    score: 0.75,
  });

  const result = await detectBusinessPositions(
    [matchingBusinessPosition],
    matchingBusinessAgendaItem,
    {
      matchNamedEntity: mockMatcher,
    }
  );

  expect(result).toHaveLength(0);
});

});