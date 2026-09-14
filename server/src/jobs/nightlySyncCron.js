import cron from "node-cron";
import { syncQueue } from "../queues/syncQueue.js";
import { SYNC_CRON_SCHEDULE } from "../config/constants.js";

export function startNightlySyncCron() {
  cron.schedule(SYNC_CRON_SCHEDULE, async () => {
  const timestamp = new Date().toISOString();
  console.log(`[Nightly Sync Cron] Triggered at ${timestamp}`);

  await syncQueue.add("run-sync", {
    triggeredAt: timestamp,
    source: "nightly-cron"
  });

  console.log("[Nightly Sync Cron] Job enqueued");
});
}