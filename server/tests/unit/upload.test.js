import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import request from "supertest";

// --- mocks (hoisted by vitest) ---------------------------------------------

vi.mock("../../src/lib/auth.js", () => {
  const requireAdmin = vi.fn((_req, _res, next) => next());
  return { requireAdmin, default: requireAdmin };
});

vi.mock("../../src/lib/prisma.js", () => {
  const tx = {
    form700Filing: { create: vi.fn() },
    scheduleAInvestment: { createMany: vi.fn() },
    scheduleBRealEstate: { createMany: vi.fn() },
    scheduleCdeIncome: { createMany: vi.fn() },
    scheduleA2BusinessPosition: { createMany: vi.fn() },
  };
  const prisma = {
    __tx: tx,
    $transaction: vi.fn(async (fn) => fn(tx)),
    form700Filing: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { prisma, default: prisma };
});

vi.mock("../../src/lib/storage.js", () => ({
  XLSX_MIME: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  archiveWorkbook: vi.fn(),
  getWorkbook: vi.fn(),
  deleteWorkbook: vi.fn(),
}));

vi.mock("../../src/utils/findOrCreatePolitician.js", () => ({
  findOrCreatePolitician: vi.fn(),
}));

// Belt and braces: app.js does not schedule cron, but never let a test touch it.
vi.mock("../../src/jobs/scheduleCronJobs.js", () => ({ scheduleCronJobs: vi.fn() }));

import { app } from "../../src/app.js";
import { requireAdmin } from "../../src/lib/auth.js";
import { prisma } from "../../src/lib/prisma.js";
import { archiveWorkbook, XLSX_MIME } from "../../src/lib/storage.js";
import { findOrCreatePolitician } from "../../src/utils/findOrCreatePolitician.js";

const ENDPOINT = "/api/admin/upload/form700";
const validBuffer = fs.readFileSync(path.resolve("tests/fixtures/form700-valid.xlsx"));
const malformedBuffer = fs.readFileSync(path.resolve("tests/fixtures/form700-malformed.xlsx"));

const POLITICIAN_ID = "11111111-2222-4333-8444-555555555555";
const FILING_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ARCHIVED_PATH = `filings/${POLITICIAN_ID}/${FILING_ID}/123-form700-valid.xlsx`;

function postFile(buffer, { filename = "form700-valid.xlsx", contentType = XLSX_MIME, fields = {} } = {}) {
  let req = request(app).post(ENDPOINT).set("Authorization", "Bearer test-jwt");
  for (const [key, value] of Object.entries(fields)) {
    req = req.field(key, value);
  }
  return req.attach("file", buffer, { filename, contentType });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  requireAdmin.mockImplementation((_req, _res, next) => next());
  findOrCreatePolitician.mockResolvedValue(POLITICIAN_ID);
  prisma.form700Filing.findUnique.mockResolvedValue(null);
  prisma.form700Filing.update.mockResolvedValue({ id: FILING_ID });
  prisma.form700Filing.delete.mockResolvedValue({ id: FILING_ID });
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma.__tx));
  prisma.__tx.form700Filing.create.mockResolvedValue({ id: FILING_ID });
  for (const model of [
    "scheduleAInvestment",
    "scheduleBRealEstate",
    "scheduleCdeIncome",
    "scheduleA2BusinessPosition",
  ]) {
    prisma.__tx[model].createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
  }
  archiveWorkbook.mockResolvedValue(ARCHIVED_PATH);
});

describe("POST /api/admin/upload/form700", () => {
  it("ingests a valid XLSX: 200 with filing id, politician id, schedule counts and archive path", async () => {
    const res = await postFile(validBuffer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      filing_id: FILING_ID,
      politician_id: POLITICIAN_ID,
      schedules_parsed: { A: 39, B: 15, CDE: 24, A2: 17 },
      archived_path: ARCHIVED_PATH,
    });

    // Politician resolved from the cover-page/filer metadata, not a form field.
    expect(findOrCreatePolitician).toHaveBeenCalledWith("James M Gore", null, {
      officeTitle: "Supervisor",
    });

    // Duplicate pre-check on the (politicianId, filingYear) unique key.
    expect(prisma.form700Filing.findUnique).toHaveBeenCalledWith({
      where: { politicianId_filingYear: { politicianId: POLITICIAN_ID, filingYear: 2019 } },
      select: { id: true },
    });

    // Single transaction: filing + all four schedule createMany calls.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const tx = prisma.__tx;
    expect(tx.form700Filing.create).toHaveBeenCalledTimes(1);
    expect(tx.form700Filing.create.mock.calls[0][0].data).toMatchObject({
      politicianId: POLITICIAN_ID,
      filingYear: 2019,
      filerName: "James M Gore",
      originalFilename: "form700-valid.xlsx",
    });

    expect(tx.scheduleAInvestment.createMany).toHaveBeenCalledTimes(1);
    expect(tx.scheduleBRealEstate.createMany).toHaveBeenCalledTimes(1);
    expect(tx.scheduleCdeIncome.createMany).toHaveBeenCalledTimes(1);
    expect(tx.scheduleA2BusinessPosition.createMany).toHaveBeenCalledTimes(1);

    // Rows are mapped to Prisma camelCase fields and tagged with filing/politician ids.
    const aRows = tx.scheduleAInvestment.createMany.mock.calls[0][0].data;
    expect(aRows).toHaveLength(39);
    expect(aRows[0]).toEqual({
      filingId: FILING_ID,
      politicianId: POLITICIAN_ID,
      entityName: "Scoop",
      fairMarketValue: "$2,000 - $10,000",
      natureOfInvestment: "Advisory Shares",
    });
    expect(aRows[0]).not.toHaveProperty("entity_name");

    const bRows = tx.scheduleBRealEstate.createMany.mock.calls[0][0].data;
    expect(bRows[0]).toMatchObject({ city: "Penngrove", county: null });
    expect(bRows[0]).not.toHaveProperty("agency");

    const cdeRows = tx.scheduleCdeIncome.createMany.mock.calls[0][0].data;
    expect(new Set(cdeRows.map((r) => r.scheduleType))).toEqual(new Set(["C", "D", "E"]));

    const a2Rows = tx.scheduleA2BusinessPosition.createMany.mock.calls[0][0].data;
    expect(a2Rows[0]).toMatchObject({
      entityName: "Gore Family Vineyards",
      businessPosition: "Co-Owner",
      grossIncomeRange: "$0 - $499",
    });

    // Archived AFTER commit, then path recorded on the filing.
    expect(archiveWorkbook).toHaveBeenCalledTimes(1);
    const [buf, filename, ids] = archiveWorkbook.mock.calls[0];
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.equals(validBuffer)).toBe(true);
    expect(filename).toBe("form700-valid.xlsx");
    expect(ids).toEqual({ filingId: FILING_ID, politicianId: POLITICIAN_ID });
    expect(prisma.form700Filing.update).toHaveBeenCalledWith({
      where: { id: FILING_ID },
      data: { archivedPath: ARCHIVED_PATH, storagePath: ARCHIVED_PATH },
    });
    expect(prisma.form700Filing.delete).not.toHaveBeenCalled();
  });

  it("uses an explicit politician_id form field instead of entity resolution", async () => {
    const override = "99999999-8888-4777-8666-555555555555";
    const res = await postFile(validBuffer, { fields: { politician_id: override } });

    expect(res.status).toBe(200);
    expect(res.body.politician_id).toBe(override);
    expect(findOrCreatePolitician).not.toHaveBeenCalled();
  });

  it("returns 400 for non-XLSX bytes renamed to .xlsx", async () => {
    const res = await postFile(Buffer.from("this,is,a,csv\n1,2,3,4\n"), { filename: "fake.xlsx" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recognizable Form 700|valid XLSX/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(archiveWorkbook).not.toHaveBeenCalled();
  });

  it("returns 400 for the malformed fixture", async () => {
    const res = await postFile(malformedBuffer, { filename: "form700-malformed.xlsx" });

    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when the MIME type is not XLSX", async () => {
    const res = await postFile(validBuffer, { contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid file type/);
  });

  it("returns 400 when no file is attached", async () => {
    const res = await request(app)
      .post(ENDPOINT)
      .set("Authorization", "Bearer test-jwt")
      .field("politician_id", POLITICIAN_ID);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing XLSX upload/);
  });

  it("returns 401 for an unauthenticated request and never touches parsing or the DB", async () => {
    requireAdmin.mockImplementation((_req, res) => res.status(401).json({ error: "unauthorized" }));

    const res = await request(app).post(ENDPOINT).attach("file", validBuffer, {
      filename: "form700-valid.xlsx",
      contentType: XLSX_MIME,
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
    expect(findOrCreatePolitician).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(archiveWorkbook).not.toHaveBeenCalled();
  });

  it("returns 409 when a filing for the same politician + year already exists (pre-check)", async () => {
    prisma.form700Filing.findUnique.mockResolvedValue({ id: "existing-filing" });

    const res = await postFile(validBuffer);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
    expect(res.body.filing_id).toBe("existing-filing");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(archiveWorkbook).not.toHaveBeenCalled();
  });

  it("returns 409 when the transaction hits the unique constraint (Prisma P2002 race)", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prisma.__tx.form700Filing.create.mockRejectedValue(p2002);

    const res = await postFile(validBuffer);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
    expect(archiveWorkbook).not.toHaveBeenCalled();
  });

  it("returns 413 for a file larger than 10 MB", async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41);

    const res = await postFile(big, { filename: "huge.xlsx" });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/10 MB/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes the filing and returns 500 when archiving fails after commit", async () => {
    archiveWorkbook.mockRejectedValue(new Error("bucket unavailable"));

    const res = await postFile(validBuffer);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to archive workbook/);
    expect(prisma.form700Filing.delete).toHaveBeenCalledWith({ where: { id: FILING_ID } });
    expect(prisma.form700Filing.update).not.toHaveBeenCalled();
  });

  it("does not archive anything when a schedule insert fails inside the transaction", async () => {
    prisma.__tx.scheduleBRealEstate.createMany.mockRejectedValue(new Error("insert failed"));

    const res = await postFile(validBuffer);

    expect(res.status).toBe(500);
    expect(archiveWorkbook).not.toHaveBeenCalled();
    expect(prisma.form700Filing.update).not.toHaveBeenCalled();
  });

  it("returns 400 when neither the cover page nor the form supplies a filer", async () => {
    // Workbook with a recognisable sheet name but no filer columns / cover page.
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["NAME OF BUSINESS ENTITY", "FAIR MARKET VALUE"], ["Acme", "$2,000 - $10,000"]]),
      "Schedule A",
    );
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const missingYear = await postFile(buffer, { filename: "nocover.xlsx" });
    expect(missingYear.status).toBe(400);
    expect(missingYear.body.error).toMatch(/filing year/i);

    const missingFiler = await postFile(buffer, { filename: "nocover.xlsx", fields: { filing_year: "2025" } });
    expect(missingFiler.status).toBe(400);
    expect(missingFiler.body.error).toMatch(/filer name/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
