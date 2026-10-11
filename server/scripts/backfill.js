import '../src/lib/env.js';
import { runNightlyLegistarSync } from '../src/jobs/nightlySync.js';

const BACKFILL_LOOKBACK_DAYS = 365 * 2;
export function readCityArgument(argv = []) {
  const index = argv.indexOf('--city');

  if (index === -1) {
    return null;
  }

  const city = argv[index + 1]?.trim();

  if (!city || city.startsWith('--')) {
    throw new Error('The --city option requires a city name');
  }

  return city;
}

export async function runBackfill({
  city = null,
  run = runNightlyLegistarSync,
  log = console.log,
} = {}) {
  const startedAt = Date.now();

  const result = await run({
    lookbackDays: BACKFILL_LOOKBACK_DAYS,
    city,
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
  const city = readCityArgument(process.argv.slice(2));

  runBackfill({ city }).catch((error) => {
    console.error('[backfill] command failed:', error);
    process.exitCode = 1;
  });
}