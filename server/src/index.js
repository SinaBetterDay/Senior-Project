import './lib/env.js';
import { app } from './app.js';
import { scheduleCronJobs } from './jobs/scheduleCronJobs.js';
import { recoverStaleSyncJobRuns } from './jobs/syncJobRun.js';

try {
  const { recovered } = await recoverStaleSyncJobRuns();
  if (recovered > 0) console.warn(`[sync] recovered ${recovered} interrupted run(s)`);
} catch (error) {
  console.error('[sync] startup run recovery failed:', error);
}
scheduleCronJobs();

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});
