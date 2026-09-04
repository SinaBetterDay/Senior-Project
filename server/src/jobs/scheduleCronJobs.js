import cron from 'node-cron';
import { runApifyAgendaScrape } from './runApifyAgendaScrape.js';

export function scheduleCronJobs() {
  const enabled = (process.env.CRON_ENABLED ?? 'true').toLowerCase() === 'true';
  if (!enabled) {
    console.log('[cron] disabled via CRON_ENABLED=false');
    return;
  }

  // Weekly by default (Mondays at 03:10). Railway deployments should ensure only
  // one instance runs this scheduler to avoid duplicate runs.
  const schedule = process.env.APIFY_AGENDA_CRON_SCHEDULE ?? '10 3 * * 1';

  cron.schedule(schedule, async () => {
    try {
      console.log('[cron] starting Apify agenda scrape');
      const items = await runApifyAgendaScrape({
        lookbackDays: process.env.APIFY_LOOKBACK_DAYS
          ? Number(process.env.APIFY_LOOKBACK_DAYS)
          : 14,
      });
      console.log(`[cron] Apify agenda scrape finished: ${items.length} item(s)`);
    } catch (err) {
      console.error('[cron] Apify agenda scrape failed:', err);
    }
  });

  console.log('[cron] scheduled Apify agenda scrape:', schedule);
}

