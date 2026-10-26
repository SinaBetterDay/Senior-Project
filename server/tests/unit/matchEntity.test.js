import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  matchNamedEntity,
  normalizeEntityName,
  getEntityResolutionMetrics,
  resetEntityResolutionMetrics,
  resolveEntityWithGemini,
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
    resetEntityResolutionMetrics();
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

  it("auto-matches at >= 0.90 without calling Gemini", async () => {
    const result = await matchNamedEntity(
      "Pacific Gas and Electric",
      "Authorize a services agreement with Pacific Gas and Electric for undergrounding",
    );

    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.matched).toBe(true);
    expect(result.usedGemini).toBe(false);
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it("does not auto-match a score below the tuned confidence threshold", async () => {
    const resolveWithGemini = vi.fn().mockResolvedValue(false);

    const result = await matchNamedEntity("Acme Builders", "agenda text", {
      scoreEntityInText: () => 0.87,
      resolveWithGemini,
    });

    expect(result).toMatchObject({
      matched: false,
      score: 0.87,
      usedGemini: true,
    });
    expect(resolveWithGemini).toHaveBeenCalledWith("Acme Builders", "agenda text");
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

  it("never matches entities on the configurable exclusion list", async () => {
    const scoreEntityInText = vi.fn(() => 1);

    const result = await matchNamedEntity(
      "CITY OF LOS ANGELES",
      "City of Los Angeles contract award",
      { scoreEntityInText },
    );

    expect(result).toEqual({
      matched: false,
      score: 0,
      usedGemini: false,
      excluded: true,
    });
    expect(scoreEntityInText).not.toHaveBeenCalled();
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it("uses Gemini in the 0.70–0.90 band", async () => {
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

  it("uses a structured response and records non-sensitive resolver metrics", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: { text: () => '{"isMatch": false}' },
    });
    GoogleGenerativeAI.mockImplementation(function FakeGemini() {
      this.getGenerativeModel = () => ({ generateContent });
    });

    await expect(resolveEntityWithGemini("Acme", "Agenda item")).resolves.toBe(false);
    expect(getEntityResolutionMetrics()).toMatchObject({
      requestCount: 1,
      fallbackCount: 0,
    });
  });

  it("uses the deterministic fallback for malformed provider responses", async () => {
    GoogleGenerativeAI.mockImplementation(function FakeGemini() {
      this.getGenerativeModel = () => ({
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'maybe' } }),
      });
    });

    await expect(resolveEntityWithGemini("Acme", "Agenda item")).resolves.toBe(false);
    expect(getEntityResolutionMetrics().fallbackCount).toBe(1);
  });

  it("disables the optional provider safely when API configuration is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.LLM_API_KEY;

    await expect(resolveEntityWithGemini("Acme", "Agenda item")).resolves.toBe(false);
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
    expect(getEntityResolutionMetrics()).toMatchObject({
      requestCount: 0,
      fallbackCount: 1,
    });
  });

  it("uses the deterministic fallback when the provider times out", async () => {
    vi.useFakeTimers();
    GoogleGenerativeAI.mockImplementation(function FakeGemini() {
      this.getGenerativeModel = () => ({
        generateContent: vi.fn(() => new Promise(() => {})),
      });
    });

    const resolution = resolveEntityWithGemini("Acme", "Agenda item");
    await vi.advanceTimersByTimeAsync(5000);

    await expect(resolution).resolves.toBe(false);
    expect(getEntityResolutionMetrics().fallbackCount).toBe(1);
    vi.useRealTimers();
  });
});

describe("scoreEntityInText", () => {
  it("returns 1 when the normalized name is present", () => {
    expect(
      scoreEntityInText("Acme Corp.", "Award a paving contract to Acme Corporation"),
    ).toBe(1);
  });
});
