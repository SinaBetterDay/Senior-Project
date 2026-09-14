import { describe, expect, it } from "vitest";
import { areSameEntity, normalizeEntityName } from "../../src/utils/entityNorm.js";

describe("normalizeEntityName", () => {
  it("normalizes casing, punctuation, whitespace, and legal suffixes", () => {
    expect(normalizeEntityName(" Acme Corp. ")).toBe("acme");
    expect(normalizeEntityName("ACME CORPORATION")).toBe("acme");
    expect(normalizeEntityName("Riverbank Development, LLC")).toBe(
      "riverbank development",
    );
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeEntityName("")).toBe("");
    expect(normalizeEntityName(null)).toBe("");
  });
});

describe("areSameEntity", () => {
  it("matches exact names and common presentation variations", () => {
    expect(areSameEntity("Acme Corp.", "ACME CORPORATION")).toBe(true);
    expect(areSameEntity("Acme-Builder's, LLC", "acme builders")).toBe(true);
  });

  it("matches names with at least 88% Levenshtein similarity", () => {
    expect(areSameEntity("Acme Developmnt", "Acme Development")).toBe(true);
  });

  it("does not match clearly different or empty names", () => {
    expect(areSameEntity("Acme Builders", "Northstar Paving")).toBe(false);
    expect(areSameEntity("", "")).toBe(false);
    expect(areSameEntity("Acme", "")).toBe(false);
  });
});
