import '../src/lib/env.js';
import { runNightlyLegistarSync } from '../src/jobs/nightlySync.js';

const BACKFILL_LOOKBACK_DAYS = 365 * 2;

export async function runBackfill({
  run = runNightlyLegistarSync,
  log = console.log,
} = {}) {
  const startedAt = Date.now();

  const result = await run({
    lookbackDays: BACKFILL_LOOKBACK_DAYS,
  });

  log(
    `[backfill] complete cities=${result.citiesProcessed} ` +
      `items_found=${result.itemsFound} inserted=${result.inserted} ` +
      `conflicts=${result.conflictsDetected} ` +
      `elapsed_ms=${Date.now() - startedAt}`,
  );

  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBackfill().catch((error) => {
    console.error('[backfill] command failed:', error);
    process.exitCode = 1;
  });
}