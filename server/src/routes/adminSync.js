import express from "express";
import { runNightlyLegistarSync } from "../jobs/nightlySync.js";

const router = express.Router();

router.post("/run-nightly-sync", async (req, res) => {
  const timestamp = new Date().toISOString();

  console.log(`[Admin API] Manual nightly sync triggered at ${timestamp}`);

  try {
    const result = await runNightlyLegistarSync();
    return res.json({ ok: true, triggeredAt: timestamp, result });
  } catch (error) {
    console.error("[Admin API] Manual nightly sync failed:", error);
    return res.status(500).json({ error: "Nightly sync failed" });
  }
});

export default router;