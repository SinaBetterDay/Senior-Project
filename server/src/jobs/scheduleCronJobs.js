import cron from 'node-cron';
import { runApifyAgendaScrape } from './runApifyAgendaScrape.js';
import { runNightlyLegistarSync } from './nightlySync.js';

function positiveIntegerEnv(name, fallback) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function scheduleCronJobs() {
  const enabled = process.env.CRON_ENABLED === 'true';
  if (!enabled) {
    console.log('[cron] disabled via CRON_ENABLED=false');
    return;
  }

  const timezone = process.env.CRON_TIMEZONE ?? 'America/Los_Angeles';
  const legistarSchedule = process.env.LEGISTAR_CRON_SCHEDULE ?? '0 2 * * *';
  cron.schedule(legistarSchedule, async () => {
    try {
      console.log('[cron] starting nightly Legistar sync');
      await runNightlyLegistarSync({
        lookbackDays: positiveIntegerEnv('LEGISTAR_LOOKBACK_DAYS', 30),
      });
    } catch (err) {
      console.error('[cron] nightly Legistar sync failed:', err);
    }
  }, { timezone });
  console.log(`[cron] scheduled nightly Legistar sync: ${legistarSchedule} (${timezone})`);

  const apifySchedule = process.env.APIFY_AGENDA_CRON_SCHEDULE ?? '10 3 * * 1';

  cron.schedule(apifySchedule, async () => {
    try {
      console.log('[cron] starting Apify agenda scrape');
      const result = await runApifyAgendaScrape({
        lookbackDays: positiveIntegerEnv('APIFY_LOOKBACK_DAYS', 14),
      });
      console.log(
        `[cron] Apify agenda ingestion finished: ${result.documentsFound} document(s), ${result.pdfsFetched} PDF(s) fetched, ${result.itemsInserted} agenda item(s) inserted, ${result.itemsSkipped} skipped, ${result.errors} error(s)`,
      );
    } catch (err) {
      console.error('[cron] Apify agenda scrape failed:', err);
    }
  }, { timezone });

  console.log(`[cron] scheduled Apify agenda scrape: ${apifySchedule} (${timezone})`);
}
