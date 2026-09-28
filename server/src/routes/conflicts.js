import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

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

export default router;
