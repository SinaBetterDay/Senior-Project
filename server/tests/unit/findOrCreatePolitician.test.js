import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../src/supabaseClient.js";
import { findOrCreatePolitician } from "../../src/utils/findOrCreatePolitician.js";

vi.mock("../../src/supabaseClient.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(),
}));

function createSelectQuery(records) {
  return {
    eq: vi.fn().mockResolvedValue({
      data: records,
      error: null,
    }),
    then: (resolve) =>
      resolve({
        data: records,
        error: null,
      }),
  };
}

function mockSupabaseSelect(records) {
  supabase.from.mockReturnValue({
    select: vi.fn(() => createSelectQuery(records)),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});
// Test 1: exact match
describe("findOrCreatePolitician", () => {
  it("returns existing politician ID for exact match", async () => {
    mockSupabaseSelect([
      {
        id: 1,
        name: "John Smith",
        district: "District 1",
      },
    ]);

    const result = await findOrCreatePolitician("John Smith", "District 1");

    expect(result).toBe(1);
  });
  // Test 2: minor variation match
  it("returns existing politician ID for minor variation match", async () => {
    mockSupabaseSelect([
      {
        id: 2,
        name: "John Smith",
        district: "District 1",
      },
    ]);

    const result = await findOrCreatePolitician("John Smith.", "District 1");

    expect(result).toBe(2);
  });
  // Test 3: completely new name creates a record
  it("creates new politician when no match is found", async () => {
    const selectQuery = createSelectQuery([
      {
        id: 1,
        name: "John Smith",
        district: "District 1",
      },
    ]);

    const insertChain = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 99 },
            error: null,
          }),
        })),
      })),
    };

    supabase.from
      .mockReturnValueOnce({
        select: vi.fn(() => selectQuery),
      })
      .mockReturnValueOnce(insertChain);

    const result = await findOrCreatePolitician(
      "Completely New Person",
      "District 1"
    );

    expect(result).toBe(99);

    expect(insertChain.insert).toHaveBeenCalledWith({
      name: "Completely New Person",
      district: "District 1",
      needs_review: true,
    });
  });
  // Test 4: empty string input
  it("throws an error for empty string input", async () => {
    await expect(findOrCreatePolitician("", "District 1")).rejects.toThrow(
      "filerName cannot be empty"
    );

    expect(supabase.from).not.toHaveBeenCalled();
  });
});