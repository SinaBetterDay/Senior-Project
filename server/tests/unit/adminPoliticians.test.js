import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.js", () => {
  const tx = {
    politician: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    politicianReviewEvent: { create: vi.fn(), findUnique: vi.fn() },
    form700Filing: { findMany: vi.fn(), updateMany: vi.fn() },
    voteRecord: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    conflict: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    conflictReview: { updateMany: vi.fn() },
    conflictFlag: { updateMany: vi.fn() },
    scheduleAInvestment: { updateMany: vi.fn() },
    scheduleBRealEstate: { updateMany: vi.fn() },
    scheduleCdeIncome: { updateMany: vi.fn() },
    scheduleA2BusinessPosition: { updateMany: vi.fn() },
    jurisdiction: { findFirst: vi.fn(), create: vi.fn() },
  };
  tx.$transaction = vi.fn(async (callback) => callback(tx));
  return { prisma: tx, default: tx };
});

import { prisma } from "../../src/lib/prisma.js";
import politiciansRouter from "../../src/routes/admin/politicians.js";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = { id: "admin-1" }; next(); });
app.use("/api/admin/politicians", politiciansRouter);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  for (const model of [prisma.form700Filing, prisma.conflictFlag, prisma.scheduleAInvestment, prisma.scheduleBRealEstate, prisma.scheduleCdeIncome, prisma.scheduleA2BusinessPosition]) {
    model.updateMany?.mockResolvedValue({ count: 0 });
  }
  prisma.voteRecord.findMany.mockResolvedValue([]);
  prisma.conflict.findMany.mockResolvedValue([]);
  prisma.form700Filing.findMany.mockResolvedValue([]);
});

describe("admin politician review", () => {
  it("approves a needs-review politician and records the action", async () => {
    prisma.politician.findUnique.mockResolvedValue({ id: SOURCE_ID, needsReview: true });
    const response = await request(app).post(`/api/admin/politicians/${SOURCE_ID}/approve`);
    expect(response.status).toBe(200);
    expect(prisma.politician.update).toHaveBeenCalledWith({ where: { id: SOURCE_ID }, data: { needsReview: false } });
    expect(prisma.politicianReviewEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ politicianId: SOURCE_ID, action: "approved", adminUserId: "admin-1" }) });
  });

  it("blocks deletion when filings are linked", async () => {
    prisma.politician.findUnique.mockResolvedValue({ id: SOURCE_ID, _count: { filings: 2, votes: 0, conflicts: 0, conflictFlags: 0 } });
    const response = await request(app).delete(`/api/admin/politicians/${SOURCE_ID}`);
    expect(response.status).toBe(409);
    expect(response.body.filing_count).toBe(2);
    expect(prisma.politician.delete).not.toHaveBeenCalled();
  });

  it("reconciles a duplicate and preserves linked records", async () => {
    prisma.politician.findUnique.mockImplementation(async ({ where }) => where.id === SOURCE_ID ? { id: SOURCE_ID, fullName: "Jane Smyth" } : { id: TARGET_ID, fullName: "Jane Smith" });
    prisma.form700Filing.findMany.mockImplementation(async ({ where }) => where.politicianId === SOURCE_ID ? [{ id: "filing-1", filingYear: 2025 }] : []);
    prisma.voteRecord.findMany.mockResolvedValue([{ id: "vote-1", agendaItemId: "agenda-1", vote: "AYE" }]);
    prisma.voteRecord.findUnique.mockResolvedValue(null);
    const response = await request(app).post(`/api/admin/politicians/${SOURCE_ID}/reconcile`).send({ targetPoliticianId: TARGET_ID });
    expect(response.status).toBe(200);
    expect(prisma.voteRecord.update).toHaveBeenCalledWith({ where: { id: "vote-1" }, data: { politicianId: TARGET_ID } });
    expect(prisma.form700Filing.updateMany).toHaveBeenCalledWith({ where: { politicianId: SOURCE_ID }, data: { politicianId: TARGET_ID } });
    expect(prisma.politicianReviewEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ politicianId: TARGET_ID, sourcePoliticianId: SOURCE_ID, action: "merged" }) });
    expect(prisma.politician.delete).toHaveBeenCalledWith({ where: { id: SOURCE_ID } });
  });

  it("rejects reconciliation when both profiles have a filing for the same year", async () => {
    prisma.politician.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, fullName: where.id === SOURCE_ID ? "Duplicate" : "Survivor" }));
    prisma.form700Filing.findMany.mockImplementation(async ({ where }) => [{ id: `${where.politicianId}-filing`, filingYear: 2025 }]);
    const response = await request(app).post(`/api/admin/politicians/${SOURCE_ID}/reconcile`).send({ targetPoliticianId: TARGET_ID });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/filings for 2025/);
    expect(prisma.politician.delete).not.toHaveBeenCalled();
  });
});