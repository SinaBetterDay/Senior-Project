import cron from "node-cron";
import { syncQueue } from "../queues/syncQueue.js";
import { SYNC_CRON_SCHEDULE } from "../config/constants.js";

export function startNightlySyncCron() {
  cron.schedule(SYNC_CRON_SCHEDULE, async () => {
    console.log("[Nightly Sync] Cron triggered");

    await syncQueue.add("run-sync", {
      triggeredAt: new Date().toISOString(),
    });
  });
}
