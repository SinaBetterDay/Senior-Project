import express from "express";
import { prisma } from "../lib/prisma.js";
import { normalizeEntityName } from "../utils/entityNorm.js";

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/", async (_req, res, next) => {
  try {
    const conflicts = await prisma.conflict.findMany({
      include: {
        politician: { select: { fullName: true, jurisdiction: { select: { name: true } } } },
        agendaItem: { select: { title: true, description: true, itemText: true, cityName: true } },
      },
      orderBy: { detectedAt: "desc" },
      take: 1000,
    });

    res.status(200).json({
      data: conflicts.map((conflict) => ({
        id: conflict.id,
        politicianName: conflict.politician.fullName,
        city: conflict.agendaItem.cityName ?? conflict.politician.jurisdiction?.name ?? "Unknown",
        conflictType: conflict.conflictType,
        severity: conflict.severity,
        agendaItemSummary:
          conflict.agendaItem.title ?? conflict.agendaItem.description ?? conflict.agendaItem.itemText ?? "Agenda item unavailable",
        detectedAt: conflict.detectedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const STREET_ABBREVIATIONS = [
  [/\b(street|str)\b/g, "st"],
  [/\bavenue\b/g, "ave"],
  [/\bboulevard\b/g, "blvd"],
  [/\broad\b/g, "rd"],
  [/\bdrive\b/g, "dr"],
  [/\blane\b/g, "ln"],
  [/\bcourt\b/g, "ct"],
  [/\bplace\b/g, "pl"],
  [/\bhighway\b/g, "hwy"],
  [/\bcircle\b/g, "cir"],
  [/\bparkway\b/g, "pkwy"],
];

function canonicalizeLocation(value) {
  let text = String(value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of STREET_ABBREVIATIONS) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

function sourceMatches(conflict, label) {
  if (!label) return false;

  if (conflict.conflictType === "REAL_ESTATE") {
    return conflict.sourceKey === `REAL_ESTATE:${canonicalizeLocation(label) || "property"}`;
  }

  const fallback = ["INCOME", "GIFT", "TRAVEL"].includes(conflict.conflictType)
    ? "source"
    : "entity";

  return conflict.sourceKey === `${conflict.conflictType}:${normalizeEntityName(label) || fallback}`;
}

function formatScheduleEntry(row, scheduleType) {
  if (!row) return null;

  return {
    scheduleType,
    entityName: row.entityName ?? row.sourceName ?? row.propertyDescription ?? null,
    dollarValue: row.fairMarketValue ?? row.amount ?? row.grossIncomeRange ?? null,
    natureOfInterest: row.natureOfInvestment ?? row.natureOfInterest ?? row.businessPosition ?? null,
  };
}

async function findScheduleEntry(conflict) {
  const politicianWhere = {
    OR: [
      { politicianId: conflict.politicianId },
      { filing: { politicianId: conflict.politicianId } },
    ],
  };
  const orderBy = { createdAt: "desc" };

  switch (conflict.conflictType) {
    case "INVESTMENT": {
      const rows = await prisma.scheduleAInvestment.findMany({ where: politicianWhere, orderBy });
      return formatScheduleEntry(rows.find((row) => sourceMatches(conflict, row.entityName)), "A");
    }
    case "REAL_ESTATE": {
      const rows = await prisma.scheduleBRealEstate.findMany({ where: politicianWhere, orderBy });
      return formatScheduleEntry(
        rows.find((row) => (
          sourceMatches(conflict, row.propertyDescription)
          || sourceMatches(conflict, row.city)
          || sourceMatches(conflict, row.county)
        )),
        "B",
      );
    }
    case "BUSINESS_POSITION": {
      const rows = await prisma.scheduleA2BusinessPosition.findMany({ where: politicianWhere, orderBy });
      return formatScheduleEntry(rows.find((row) => sourceMatches(conflict, row.entityName)), "A-2");
    }
    case "INCOME":
    case "GIFT":
    case "TRAVEL": {
      const scheduleType = { INCOME: "C", GIFT: "D", TRAVEL: "E" }[conflict.conflictType];
      const rows = await prisma.scheduleCdeIncome.findMany({
        where: { AND: [politicianWhere, { scheduleType }] },
        orderBy,
      });
      return formatScheduleEntry(rows.find((row) => sourceMatches(conflict, row.sourceName)), scheduleType);
    }
    default:
      return null;
  }
}

router.get("/:id", async (req, res, next) => {
  if (!UUID.test(req.params.id)) {
    return res.status(404).json({ error: "Conflict not found" });
  }

  try {
    const conflict = await prisma.conflict.findUnique({
      where: { id: req.params.id },
      include: {
        politician: true,
        agendaItem: { include: { meeting: { include: { jurisdiction: true } } } },
      },
    });

    if (!conflict) {
      return res.status(404).json({ error: "Conflict not found" });
    }

    const scheduleEntry = await findScheduleEntry(conflict);
    const agendaItem = conflict.agendaItem;

    return res.status(200).json({
      data: {
        id: conflict.id,
        politician: {
          name: conflict.politician.fullName,
          district: conflict.politician.district,
        },
        conflictType: conflict.conflictType,
        severity: conflict.severity,
        ruleReference: conflict.ruleReference,
        entityName: conflict.entityName,
        scheduleEntry,
        agendaItem: {
          title: agendaItem.title,
          text: agendaItem.itemText ?? agendaItem.description ?? agendaItem.title,
          meetingDate: agendaItem.meetingDate ?? agendaItem.meeting?.meetingDate ?? null,
          city: agendaItem.cityName ?? agendaItem.meeting?.jurisdiction?.name ?? null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
