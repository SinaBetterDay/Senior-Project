// Public API stub — full implementation is Sprint 6.
// Mounted at /api/politicians in server/src/app.js.
import express from 'express';
import { prisma } from "../lib/prisma.js";

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const politicians = await prisma.politician.findMany({ 
      select: { 
        id: true,
        fullName: true,
        district: true,
        _count: {
          select: {
            conflicts: true,
          },
        },
      },
      orderBy: {
        fullName: "asc", // alphabetical list
      },
    });

    const data = politicians.map((politician) => ({ 
      id: politician.id,
      fullName: politician.fullName,
      district: politician.district,
      conflictCount: politician._count.conflicts,
    }));

    res.status(200).json({ data }); 
  } catch (error) {
    console.error("Failed to fetch politicians:", error);

    res.status(500).json({ 
      error: "Failed to fetch politicians",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const politician = await prisma.politician.findUnique({
      where: {
        id: req.params.id,
      },
      select: {
        id: true,
        fullName: true,
        district: true,
        filings: {
          select: {
            id: true,
            filingYear: true,
            filedAt: true,
            filerName: true,
          },
          orderBy: {
            filingYear: "desc",
          },
        },
        conflicts: {
          select: {
            id: true,
            conflictType: true,
            severity: true,
            entityName: true,
            ruleReference: true,
            detectedAt: true,
            agendaItemId: true,
            agendaItem: {
              select: {
                id: true,
                title: true,
                meetingDate: true,
              },
            },
          },
          orderBy: {
            detectedAt: "desc",
          },
        },
      },
    });

    if (!politician) {
      return res.status(404).json({
        error: "Politician not found",
      });
    }

    res.status(200).json({
      data: politician,
    });
  } catch (error) {
    console.error("Failed to fetch politician:", error);

    res.status(500).json({
      error: "Failed to fetch politician",
    });
  }
});

export default router;
