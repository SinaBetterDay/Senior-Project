/**
 * Conflict-of-interest matching rules for Form 700 vs agenda items.
 *
 * Cite: Cal. Gov. Code §87100 (no participation in a decision in which the
 * official has a financial interest) and §87103 (what counts as a financial
 * interest: real property, sources of income, gifts, business positions).
 *
 * This file is the single source of thresholds, fuse/Gemini bands, land-use
 * keywords, and the severity stub. Detectors import from here rather than
 * hard-coding dollar cutoffs.
 */

export const GOV_CODE = {
  PARTICIPATION: "Cal. Gov. Code §87100",
  FINANCIAL_INTEREST: "Cal. Gov. Code §87103",
};

export const MATCH_BANDS = {
  AUTO_MATCH: 0.85,
  GEMINI_MIN: 0.7,
};

export const AMOUNT_THRESHOLDS = {
  INCOME: 500,
  GIFT: 50,
  TRAVEL: 50,
};

export const SEVERITY_AMOUNT = {
  HIGH: 10000,
  MEDIUM: 1000,
};

export const SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
};

export const CONFLICT_TYPES = {
  REAL_ESTATE: "REAL_ESTATE",
  INCOME: "INCOME",
  GIFT: "GIFT",
  TRAVEL: "TRAVEL",
  BUSINESS_POSITION: "BUSINESS_POSITION",
};

export const RULE_REFERENCE = {
  REAL_ESTATE: "Cal. Gov. Code §87100, §87103(b)",
  INCOME: "Cal. Gov. Code §87100, §87103(c)",
  GIFT: "Cal. Gov. Code §87100, §87103(e)",
  TRAVEL: "Cal. Gov. Code §87100, §87103(c)",
  BUSINESS_POSITION: "Cal. Gov. Code §87100, §87103(d)",
};

export const LAND_USE_KEYWORDS = [
  "zoning",
  "variance",
  "cup",
  "conditional use",
  "development",
  "parcel",
  "apn",
];

export function parseAmount(amount) {
  if (amount == null || amount === "") return null;
  if (typeof amount === "number") {
    return Number.isFinite(amount) ? amount : null;
  }
  const matches = String(amount).replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  return Math.min(...matches.map(Number));
}

export function conflictTypeForSchedule(scheduleType) {
  const type = String(scheduleType || "").toUpperCase();
  if (type === "C") return CONFLICT_TYPES.INCOME;
  if (type === "D") return CONFLICT_TYPES.GIFT;
  if (type === "E") return CONFLICT_TYPES.TRAVEL;
  return null;
}

export function meetsAmountThreshold(scheduleType, amount) {
  const type = String(scheduleType || "").toUpperCase();
  const threshold =
    type === "C"
      ? AMOUNT_THRESHOLDS.INCOME
      : type === "D"
        ? AMOUNT_THRESHOLDS.GIFT
        : type === "E"
          ? AMOUNT_THRESHOLDS.TRAVEL
          : null;
  if (threshold == null) return false;
  const dollars = parseAmount(amount);
  if (dollars == null) return true;
  return dollars >= threshold;
}

export function hasLandUseKeyword(text) {
  const n = String(text || "").toLowerCase();
  if (!n) return false;
  if (/\bconditional\s+use\b/.test(n)) return true;
  return LAND_USE_KEYWORDS.some((kw) => {
    const k = kw.toLowerCase();
    if (k === "cup") return /\bcup\b/.test(n);
    if (k === "apn") return /\bapn\b/.test(n);
    if (k === "conditional use") return false;
    return n.includes(k);
  });
}

export function calculateSeverity({ conflictType, amount } = {}) {
  if (
    conflictType === CONFLICT_TYPES.BUSINESS_POSITION ||
    conflictType === CONFLICT_TYPES.REAL_ESTATE
  ) {
    return SEVERITY.MEDIUM;
  }

  const dollars = parseAmount(amount);
  if (dollars == null) return SEVERITY.MEDIUM;
  if (dollars >= SEVERITY_AMOUNT.HIGH) return SEVERITY.HIGH;
  if (dollars >= SEVERITY_AMOUNT.MEDIUM) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
}
