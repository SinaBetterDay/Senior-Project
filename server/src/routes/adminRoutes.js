import express from "express";
import { syncQueue } from "../queues/syncQueue.js";

const router = express.Router();

router.post("/run-nightly-sync", async (req, res) => {
  const timestamp = new Date().toISOString();

  console.log(`[Admin API] Manual nightly sync triggered at ${timestamp}`);

  await syncQueue.add("run-sync", {
    triggeredAt: timestamp,
    source: "manual-api"
  });

  res.json({
    ok: true,
    message: "Nightly sync job enqueued",
    triggeredAt: timestamp
  });
});

export default router;
