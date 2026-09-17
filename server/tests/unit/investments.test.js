import { describe, it, expect, vi } from "vitest";
import { detectInvestments } from "../../src/detection/investments.js";

describe("detectInvestments", () => {
  const agendaItem = {
    id: "agenda-1",
    title: "Technology agreement with Apple Inc.",
    description:
      "Approve a municipal technology services agreement with Apple Inc.",
  };

  const investment = {
    politician_id: "politician-1",
    entity_name: "Apple Inc.",
    fair_market_value: "$10,000 - $100,000",
  };

  it("flags a matching investment", async () => {
    const mockMatcher = vi.fn().mockResolvedValue({
      matched: true,
      score: 1,
    });

    const result = await detectInvestments(
      [investment],
      agendaItem,
      { matchNamedEntity: mockMatcher }
    );

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      politician_id: "politician-1",
      agenda_item_id: "agenda-1",
      conflict_type: "INVESTMENT",
      entity_name: "Apple Inc.",
    });
  });

  it("does not flag a non-matching investment", async () => {
    const mockMatcher = vi.fn().mockResolvedValue({
      matched: false,
      score: 0.2,
    });

    const result = await detectInvestments(
      [investment],
      agendaItem,
      { matchNamedEntity: mockMatcher }
    );

    expect(result).toHaveLength(0);
  });

  it("does not flag investments below $2,000", async () => {
    const mockMatcher = vi.fn().mockResolvedValue({
      matched: true,
      score: 1,
    });

    const result = await detectInvestments(
      [
        {
          politician_id: "politician-1",
          entity_name: "Apple Inc.",
          fair_market_value: "$500 - $1,999",
        },
      ],
      agendaItem,
      { matchNamedEntity: mockMatcher }
    );

    expect(result).toHaveLength(0);
  });
});
