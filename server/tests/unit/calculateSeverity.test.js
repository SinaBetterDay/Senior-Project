import { describe, it, expect } from "vitest";

import {
  calculateSeverity,
  CONFLICT_TYPES,
  SEVERITY,
} from "../../src/config/conflictRules.js";

describe("calculateSeverity", () => {
  it.each([
  [CONFLICT_TYPES.INCOME, 999, SEVERITY.LOW],
  [CONFLICT_TYPES.INCOME, 1000, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.INCOME, 1001, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.INCOME, 9999, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.INCOME, 10000, SEVERITY.HIGH],
  [CONFLICT_TYPES.INCOME, 10001, SEVERITY.HIGH],

  [CONFLICT_TYPES.GIFT, 999, SEVERITY.LOW],
  [CONFLICT_TYPES.GIFT, 1000, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.GIFT, 1001, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.GIFT, 9999, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.GIFT, 10000, SEVERITY.HIGH],
  [CONFLICT_TYPES.GIFT, 10001, SEVERITY.HIGH],

  [CONFLICT_TYPES.TRAVEL, 999, SEVERITY.LOW],
  [CONFLICT_TYPES.TRAVEL, 1000, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.TRAVEL, 1001, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.TRAVEL, 9999, SEVERITY.MEDIUM],
  [CONFLICT_TYPES.TRAVEL, 10000, SEVERITY.HIGH],
  [CONFLICT_TYPES.TRAVEL, 10001, SEVERITY.HIGH],
])(
  "returns %s severity correctly for amount %s",
  (conflictType, amount, expected) => {
    const result = calculateSeverity({
      conflictType,
      amount,
    });

    expect(result).toBe(expected);
  }
);

  it("always returns MEDIUM for real estate", () => {
    const result = calculateSeverity({
      conflictType: CONFLICT_TYPES.REAL_ESTATE,
      amount: 50000,
    });

    expect(result).toBe(SEVERITY.MEDIUM);
  });

  it("always returns MEDIUM for business positions", () => {
    const result = calculateSeverity({
      conflictType: CONFLICT_TYPES.BUSINESS_POSITION,
      amount: 50000,
    });

    expect(result).toBe(SEVERITY.MEDIUM);
  });
});