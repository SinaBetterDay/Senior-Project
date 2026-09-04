/**
 * Admin Form 700 upload — POST /api/admin/upload/form700 (multipart, field `file`).
 *
 * Mounted in app.js behind `requireAdmin`; this router does NOT re-apply auth.
 *
 * Flow: multer (memory, 10 MB) → MIME check → XLSX.read → sheet-name sanity
 * check → parseCoverPage → resolve politician (body.politician_id override or
 * findOrCreatePolitician) → duplicate-year pre-check → single $transaction that
 * creates the filing + createMany for Schedules A / B / C-D-E / A-2 → archive the
 * raw workbook in Supabase Storage and record its path (filing deleted if the
 * archive step fails, so no orphan row or object is left behind).
 *
 * Responses
 *   200 { filing_id, politician_id, schedules_parsed: { A, B, CDE, A2 }, archived_path }
 *   400 bad/missing file, wrong MIME, unreadable XLSX, unrecognised sheets,
 *       filer/filing year could not be determined
 *   409 filing already exists for this politician + filing year
 *   413 file larger than 10 MB
 *   500 archive failure / unexpected error (via next(err))
 */
import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";

import { prisma } from "../../lib/prisma.js";
import { archiveWorkbook, XLSX_MIME } from "../../lib/storage.js";
import { parseCoverPage } from "../../parsers/coverPage.js";
import { parseScheduleA } from "../../parsers/scheduleA.js";
import { parseScheduleA2 } from "../../parsers/scheduleA2.js";
import { parseScheduleB } from "../../parsers/scheduleB.js";
import { parseScheduleCDE } from "../../parsers/scheduleCDE.js";
import { findOrCreatePolitician } from "../../utils/findOrCreatePolitician.js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const RECOGNISED_SHEET_KEYWORDS = [
  "cover",
  "schedule a",
  "schedule b",
  "schedule c",
  "schedule d",
  "schedule e",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

/** Wrap multer so size-limit errors become 413 and other multer errors 400. */
function receiveFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File too large. Maximum upload size is 10 MB." });
      }
      return res.status(400).json({ error: `Upload rejected: ${err.message}` });
    }

    return next(err);
  });
}

export function hasRecognizableForm700Sheets(sheetNames = []) {
  return sheetNames.some((name) => {
    const normalized = String(name ?? "").trim().toLowerCase();
    return RECOGNISED_SHEET_KEYWORDS.some((keyword) => normalized.includes(keyword));
  });
}

function isDuplicateError(error) {
  return error?.code === "P2002";
}

function cleanBodyString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function parseFilingYear(value) {
  const text = cleanBodyString(value);
  if (!text) return null;
  const year = Number(text);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

// --- snake_case parser rows → Prisma camelCase createMany payloads ---------

function toScheduleA(rows, ids) {
  return rows.map((row) => ({
    ...ids,
    entityName: row.entity_name,
    fairMarketValue: row.fair_market_value ?? null,
    natureOfInvestment: row.nature_of_investment ?? null,
  }));
}

function toScheduleB(rows, ids) {
  return rows.map((row) => ({
    ...ids,
    propertyDescription: row.property_description ?? null,
    city: row.city ?? null,
    county: row.county ?? null,
    fairMarketValue: row.fair_market_value ?? null,
    natureOfInterest: row.nature_of_interest ?? null,
  }));
}

function toScheduleCDE(rows, ids) {
  return rows.map((row) => ({
    ...ids,
    scheduleType: row.schedule_type,
    sourceName: row.source_name ?? null,
    amount: row.amount ?? null,
  }));
}

function toScheduleA2(rows, ids) {
  return rows.map((row) => ({
    ...ids,
    entityName: row.entity_name,
    businessPosition: row.business_position ?? null,
    fairMarketValue: row.fair_market_value ?? null,
    natureOfInvestment: row.nature_of_investment ?? null,
    grossIncomeRange: row.gross_income_range ?? null,
  }));
}

router.post("/form700", receiveFile, async (req, res, next) => {
  try {
    // 1. File present + MIME ----------------------------------------------
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Missing XLSX upload (multipart field `file`)." });
    }

    // Strict: clients must send the XLSX content type (curl: `-F "file=@x.xlsx;type=<mime>"`).
    if (req.file.mimetype !== XLSX_MIME) {
      return res.status(400).json({
        error: `Invalid file type "${req.file.mimetype}". Expected ${XLSX_MIME}.`,
      });
    }

    // 2. Readable workbook with Form 700 sheets ------------------------------
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      return res.status(400).json({ error: "Uploaded file is not a valid XLSX workbook." });
    }

    if (!workbook || !hasRecognizableForm700Sheets(workbook.SheetNames)) {
      return res.status(400).json({
        error:
          "Workbook does not contain any recognizable Form 700 sheets (Cover Page, Schedule A/A-2/B/C/D/E).",
      });
    }

    // 3. Filer metadata ------------------------------------------------------
    const cover = parseCoverPage(workbook);
    const filerName = cleanBodyString(req.body?.filer_name) ?? cover.filer_name;
    const district = cleanBodyString(req.body?.district) ?? cover.district;
    const officeTitle = cleanBodyString(req.body?.office_title) ?? cover.office_title;
    const filingYear = parseFilingYear(req.body?.filing_year) ?? cover.filing_year;

    if (!filingYear) {
      return res.status(400).json({
        error: "Could not determine the filing year from the cover page; supply `filing_year`.",
      });
    }

    // 4. Politician: explicit override or entity resolution ------------------
    let politicianId = cleanBodyString(req.body?.politician_id);
    if (politicianId && !UUID_RE.test(politicianId)) {
      return res.status(400).json({ error: "politician_id must be a UUID." });
    }

    if (!politicianId) {
      if (!filerName) {
        return res.status(400).json({
          error:
            "Could not determine the filer name from the cover page; supply `politician_id` or `filer_name`.",
        });
      }
      politicianId = await findOrCreatePolitician(filerName, district, { officeTitle });
    }

    // 5. Duplicate pre-check (unique politicianId + filingYear) ----------------
    const existing = await prisma.form700Filing.findUnique({
      where: { politicianId_filingYear: { politicianId, filingYear } },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({
        error: `A Form 700 filing for this politician and filing year (${filingYear}) already exists.`,
        filing_id: existing.id,
      });
    }

    // 6. Filing + schedule rows in one transaction ----------------------------
    let filingId;
    let schedulesParsed;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const filing = await tx.form700Filing.create({
          data: {
            politicianId,
            filingYear,
            filerName: filerName ?? null,
            originalFilename: req.file.originalname ?? null,
          },
          select: { id: true },
        });

        const ids = { filingId: filing.id, politicianId };

        const rowsA = parseScheduleA(workbook, filing.id);
        const rowsB = parseScheduleB(workbook, filing.id);
        const rowsCDE = parseScheduleCDE(workbook, filing.id);
        const rowsA2 = parseScheduleA2(workbook, filing.id);

        if (rowsA.length > 0) {
          await tx.scheduleAInvestment.createMany({ data: toScheduleA(rowsA, ids) });
        }
        if (rowsB.length > 0) {
          await tx.scheduleBRealEstate.createMany({ data: toScheduleB(rowsB, ids) });
        }
        if (rowsCDE.length > 0) {
          await tx.scheduleCdeIncome.createMany({ data: toScheduleCDE(rowsCDE, ids) });
        }
        if (rowsA2.length > 0) {
          await tx.scheduleA2BusinessPosition.createMany({ data: toScheduleA2(rowsA2, ids) });
        }

        return {
          filingId: filing.id,
          schedulesParsed: {
            A: rowsA.length,
            B: rowsB.length,
            CDE: rowsCDE.length,
            A2: rowsA2.length,
          },
        };
      });

      filingId = result.filingId;
      schedulesParsed = result.schedulesParsed;
    } catch (error) {
      if (isDuplicateError(error)) {
        return res.status(409).json({
          error: `A Form 700 filing for this politician and filing year (${filingYear}) already exists.`,
        });
      }
      throw error;
    }

    // 7. Archive the raw workbook (after commit) ------------------------------
    let archivedPath;
    try {
      archivedPath = await archiveWorkbook(req.file.buffer, req.file.originalname, {
        filingId,
        politicianId,
      });
      await prisma.form700Filing.update({
        where: { id: filingId },
        data: { archivedPath, storagePath: archivedPath },
      });
    } catch (error) {
      // Roll back the committed filing (schedule rows cascade) so a failed
      // archive never leaves a half-ingested filing behind.
      try {
        await prisma.form700Filing.delete({ where: { id: filingId } });
      } catch (cleanupError) {
        console.error("[upload] failed to delete filing after archive error:", cleanupError);
      }
      const err = new Error(`Failed to archive workbook: ${error?.message ?? error}`);
      err.statusCode = 500;
      return next(err);
    }

    return res.status(200).json({
      filing_id: filingId,
      politician_id: politicianId,
      schedules_parsed: schedulesParsed,
      archived_path: archivedPath,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
