import './lib/env.js';
import { app } from './app.js';
import { scheduleCronJobs } from './jobs/scheduleCronJobs.js';

scheduleCronJobs();

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});
