import '../lib/env.js';
import { runNightlyLegistarSync } from './nightlySync.js';

/**
 * Run the nightly Legistar sync as a one-shot process for GitHub Actions or
 * manual maintenance. A completed sync with failed cities is a failed command
 * so external schedulers surface the problem.
 */
export async function runNightlyLegistarSyncCommand({
  run = runNightlyLegistarSync,
  log = console.log,
} = {}) {
  const result = await run();

  log(`[cron][legistar] command complete: ${JSON.stringify(result)}`);

  if (result.failures > 0) {
    throw new Error(`Legistar sync completed with ${result.failures} failed city or cities`);
  }

  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNightlyLegistarSyncCommand().catch((error) => {
    console.error('[cron][legistar] command failed:', error);
    process.exitCode = 1;
  });
}