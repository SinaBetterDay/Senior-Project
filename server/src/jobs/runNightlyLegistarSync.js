import '../lib/env.js';
import { runNightlyLegistarSync } from './nightlySync.js';

/**
 * Run the Legistar sync as a one-shot operator command. Production scheduling
 * is owned by the server's node-cron process.
 */
export async function runNightlyLegistarSyncCommand({
  run = runNightlyLegistarSync,
  log = console.log,
} = {}) {
  const result = await run();

  log(`[cron][legistar] command complete: ${JSON.stringify(result)}`);

  if (result.skippedRun) {
    throw new Error('Legistar sync was skipped because another run is still active');
  }
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