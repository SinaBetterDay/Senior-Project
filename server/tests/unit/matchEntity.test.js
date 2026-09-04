import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  matchNamedEntity,
  normalizeEntityName,
  scoreEntityInText,
} from "../../src/detection/matchEntity.js";

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(),
}));

describe("normalizeEntityName", () => {
  it("lowercases, strips punctuation, and drops common suffixes", () => {
    expect(normalizeEntityName("Acme Corp.")).toBe("acme");
    expect(normalizeEntityName("ACME CORPORATION")).toBe("acme");
    expect(normalizeEntityName("Riverbank Development LLC")).toBe(
      "riverbank development",
    );
  });
});

describe("matchNamedEntity", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalLlmKey = process.env.LLM_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.LLM_API_KEY;
  });

  afterEach(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalLlmKey === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = originalLlmKey;
    }
  });

  it("auto-matches at >= 0.85 without calling Gemini", async () => {
    const result = await matchNamedEntity(
      "Pacific Gas and Electric",
      "Authorize a services agreement with Pacific Gas and Electric for undergrounding",
    );

    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.matched).toBe(true);
    expect(result.usedGemini).toBe(false);
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it("does not call Gemini and does not match below 0.7", async () => {
    const result = await matchNamedEntity(
      "Zorblax Holdings LLC",
      "Consent calendar approval of the minutes from the prior meeting",
    );

    expect(result.score).toBeLessThan(0.7);
    expect(result.matched).toBe(false);
    expect(result.usedGemini).toBe(false);
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it("uses Gemini in the 0.7–0.85 band", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: { text: () => '{"isMatch": true}' },
    });
    GoogleGenerativeAI.mockImplementation(function FakeGemini() {
      this.getGenerativeModel = () => ({ generateContent });
    });

    const result = await matchNamedEntity("Acme Builders", "agenda text", {
      scoreEntityInText: () => 0.78,
    });

    expect(GoogleGenerativeAI).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result.usedGemini).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.score).toBe(0.78);
  });

  it("does not throw when Gemini fails in the ambiguous band", async () => {
    GoogleGenerativeAI.mockImplementation(function FakeGemini() {
      this.getGenerativeModel = () => ({
        generateContent: vi.fn().mockRejectedValue(new Error("quota")),
      });
    });

    const result = await matchNamedEntity("Acme Builders", "agenda text", {
      scoreEntityInText: () => 0.8,
    });

    expect(result.usedGemini).toBe(true);
    expect(result.matched).toBe(false);
  });
});

describe("scoreEntityInText", () => {
  it("returns 1 when the normalized name is present", () => {
    expect(
      scoreEntityInText("Acme Corp.", "Award a paving contract to Acme Corporation"),
    ).toBe(1);
  });
});
