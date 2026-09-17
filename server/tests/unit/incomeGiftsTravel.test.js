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

import { detectIncomeGiftsTravel } from "../../src/detection/detectIncomeGiftsTravel.js";

import {
  matchingIncomeSource,
  matchingIncomeAgendaItem,
  nonMatchingIncomeAgendaItem,
  belowThresholdIncomeSource,
  matchingGiftSource,
  matchingGiftAgendaItem,
  matchingTravelSource,
  matchingTravelAgendaItem,
} from "../fixtures/incomeGiftsTravelFixtures.js";

describe("detectIncomeGiftsTravel", () => {
  it("flags a matching income source", async () => {
    const mockMatcher = vi.fn().mockResolvedValue({
      matched: true,
      score: 0.95,
    });

    const result = await detectIncomeGiftsTravel(
      [matchingIncomeSource],
      matchingIncomeAgendaItem,
      {
        matchNamedEntity: mockMatcher,
      }
    );

    expect(result).toHaveLength(1);
  });

  it("does not flag an income source when the entity does not match", async () => {
  const mockMatcher = vi.fn().mockResolvedValue({
    matched: false,
    score: 0.2,
  });

  const result = await detectIncomeGiftsTravel(
    [matchingIncomeSource],
    nonMatchingIncomeAgendaItem,
    {
      matchNamedEntity: mockMatcher,
    }
  );

  expect(result).toHaveLength(0);
});

it("does not flag an income source below the amount threshold", async () => {
  const mockMatcher = vi.fn().mockResolvedValue({
    matched: true,
    score: 0.95,
  });

  const result = await detectIncomeGiftsTravel(
    [belowThresholdIncomeSource],
    matchingIncomeAgendaItem,
    {
      matchNamedEntity: mockMatcher,
    }
  );

  expect(result).toHaveLength(0);
});

it("flags a matching gift source", async () => {
  const mockMatcher = vi.fn().mockResolvedValue({
    matched: true,
    score: 0.95,
  });

  const result = await detectIncomeGiftsTravel(
    [matchingGiftSource],
    matchingGiftAgendaItem,
    {
      matchNamedEntity: mockMatcher,
    }
  );

  expect(result).toHaveLength(1);
});

it("flags a matching travel source", async () => {
  const mockMatcher = vi.fn().mockResolvedValue({
    matched: true,
    score: 0.95,
  });

  const result = await detectIncomeGiftsTravel(
    [matchingTravelSource],
    matchingTravelAgendaItem,
    {
      matchNamedEntity: mockMatcher,
    }
  );

  expect(result).toHaveLength(1);
});

});