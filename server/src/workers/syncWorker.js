import { syncQueue } from "../queues/syncQueue.js";
import { runNightlyLegistarSync } from "../ingestion/legistarSync.js";

export function startSyncWorker() {
  syncQueue.process("run-sync", async (job) => {
  const start = new Date().toISOString();
  console.log(`[Sync Worker] Starting nightly sync job id=${job.id} at ${start}`);
  console.log(`[Sync Worker] Payload:`, job.data);

  try {
    const result = await runNightlyLegistarSync();

    const end = new Date().toISOString();
    console.log(`[Sync Worker] Completed job id=${job.id} at ${end}`);
    console.log(`[Sync Worker] Result:`, result);

    return {
      ...result,
      startedAt: start,
      finishedAt: end,
      jobId: job.id
    };
  } catch (err) {
    const failTime = new Date().toISOString();
    console.error(`[Sync Worker] FAILED job id=${job.id} at ${failTime}`);
    console.error(err);

    throw err;
  }
});
}
