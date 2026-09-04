import express from "express";

const router = express.Router();

export const adminSources = [
  {
    id: "sac-legistar",
    cityName: "Sacramento",
    sourceType: "Legistar",
    lastSyncTime: "2026-04-18T09:15:00Z",
    totalAgendaItems: 245,
    lastError: null,
  },
  {
    id: "elk-apify",
    cityName: "Elk Grove",
    sourceType: "Apify",
    lastSyncTime: "2026-04-17T18:40:00Z",
    totalAgendaItems: 98,
    lastError: "Timeout while scraping",
  },
  {
    id: "fresno-pdf",
    cityName: "Fresno",
    sourceType: "PDF",
    lastSyncTime: null,
    totalAgendaItems: 0,
    lastError: null,
  },
];

router.get("/sources", async (req, res) => {
  try {
    return res.json(adminSources);
  } catch (error) {
    console.error("Failed to load sources:", error);
    return res.status(500).json({ error: "Failed to load sources" });
  }
});

router.post("/sources/:id/sync", async (req, res) => {
  try {
    const { id } = req.params;
    const source = adminSources.find((s) => s.id === id);

    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }

    source.lastSyncTime = new Date().toISOString();
    source.lastError = null;

    return res.json({
      success: true,
      message: "Sync triggered successfully",
    });
  } catch (error) {
    console.error("Failed to trigger sync:", error);
    return res.status(500).json({ error: "Failed to trigger sync" });
  }
});

export default router;