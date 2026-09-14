import { syncQueue } from "../queues/syncQueue.js";
import { runNightlyLegistarSync } from "../ingestion/legistarSync.js";

export function startSyncWorker() {
  syncQueue.process("run-sync", async (job) => {
    console.log("[Sync Worker] Running nightly Legistar sync…");

    try {
      const result = await runNightlyLegistarSync();
      console.log("[Sync Worker] Sync complete:", result);
      return result;
    } catch (err) {
      console.error("[Sync Worker] Sync failed:", err);
      throw err;
    }
  });
}
