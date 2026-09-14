import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../../src/supabaseClient.js";
import {
  findOrCreatePolitician,
  slugifyName,
} from "../../src/utils/findOrCreatePolitician.js";

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

// Builds a `.insert().select().single()` chain whose results are consumed in order.
function createInsertChain(results) {
  const single = vi.fn();
  for (const result of results) {
    single.mockResolvedValueOnce(result);
  }

  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({ single })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slugifyName", () => {
  it("produces a lowercase, hyphenated slug", () => {
    expect(slugifyName("John Q. Smith, Jr.")).toBe("john-q-smith-jr");
  });

  it("strips diacritics and never returns an empty slug", () => {
    expect(slugifyName("José Ñúñez")).toBe("jose-nunez");
    expect(slugifyName("!!!")).toBe("politician");
  });
});

// Test 1: exact match
describe("findOrCreatePolitician", () => {
  it("returns existing politician ID for exact match", async () => {
    mockSupabaseSelect([
      {
        id: "11111111-1111-4111-8111-111111111111",
        full_name: "John Smith",
        district: "District 1",
      },
    ]);

    const result = await findOrCreatePolitician("John Smith", "District 1");

    expect(result).toBe("11111111-1111-4111-8111-111111111111");
  });

  // Test 2: minor variation match
  it("returns existing politician ID for minor variation match", async () => {
    mockSupabaseSelect([
      {
        id: "22222222-2222-4222-8222-222222222222",
        full_name: "John Smith",
        district: "District 1",
      },
    ]);

    const result = await findOrCreatePolitician("John Smith.", "District 1");

    expect(result).toBe("22222222-2222-4222-8222-222222222222");
  });

  // Test 3: completely new name creates a record using schema v2 columns
  it("creates new politician when no match is found", async () => {
    const selectQuery = createSelectQuery([
      {
        id: "11111111-1111-4111-8111-111111111111",
        full_name: "John Smith",
        district: "District 1",
      },
    ]);

    const insertChain = createInsertChain([
      { data: { id: "99999999-9999-4999-8999-999999999999" }, error: null },
    ]);

    supabase.from
      .mockReturnValueOnce({
        select: vi.fn(() => selectQuery),
      })
      .mockReturnValueOnce(insertChain);

    const result = await findOrCreatePolitician(
      "Completely New Person",
      "District 1"
    );

    expect(result).toBe("99999999-9999-4999-8999-999999999999");

    expect(insertChain.insert).toHaveBeenCalledTimes(1);
    expect(insertChain.insert).toHaveBeenCalledWith({
      full_name: "Completely New Person",
      slug: "completely-new-person",
      office_title: "Unknown",
      district: "District 1",
      needs_review: true,
    });
  });

  // Test 4: office title from the cover page is used when provided
  it("uses the provided office title when creating a politician", async () => {
    const insertChain = createInsertChain([
      { data: { id: "99999999-9999-4999-8999-999999999999" }, error: null },
    ]);

    supabase.from
      .mockReturnValueOnce({
        select: vi.fn(() => createSelectQuery([])),
      })
      .mockReturnValueOnce(insertChain);

    await findOrCreatePolitician("Jane Doe", "District 4", {
      officeTitle: "City Council Member",
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Jane Doe",
        slug: "jane-doe",
        office_title: "City Council Member",
      })
    );
  });

  // Test 5: slug collision retries once with a suffixed slug
  it("retries with a suffixed slug when the slug is already taken", async () => {
    const insertChain = createInsertChain([
      { data: null, error: { code: "23505", message: "duplicate key value" } },
      { data: { id: "77777777-7777-4777-8777-777777777777" }, error: null },
    ]);

    supabase.from
      .mockReturnValueOnce({
        select: vi.fn(() => createSelectQuery([])),
      })
      .mockReturnValue(insertChain);

    const result = await findOrCreatePolitician("Jane Doe", null);

    expect(result).toBe("77777777-7777-4777-8777-777777777777");
    expect(insertChain.insert).toHaveBeenCalledTimes(2);

    const secondSlug = insertChain.insert.mock.calls[1][0].slug;
    expect(secondSlug).toMatch(/^jane-doe-[a-z0-9]+$/);
  });

  // Test 6: non-unique insert errors surface immediately
  it("throws when the insert fails for a non-unique-violation reason", async () => {
    const insertChain = createInsertChain([
      { data: null, error: { code: "42P01", message: "relation does not exist" } },
    ]);

    supabase.from
      .mockReturnValueOnce({
        select: vi.fn(() => createSelectQuery([])),
      })
      .mockReturnValue(insertChain);

    await expect(findOrCreatePolitician("Jane Doe", null)).rejects.toThrow(
      "Error creating politician: relation does not exist"
    );
    expect(insertChain.insert).toHaveBeenCalledTimes(1);
  });

  // Test 7: empty string input
  it("throws an error for empty string input", async () => {
    await expect(findOrCreatePolitician("", "District 1")).rejects.toThrow(
      "filerName cannot be empty"
    );

    expect(supabase.from).not.toHaveBeenCalled();
  });
});
