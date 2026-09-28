import { describe, expect, it, vi } from 'vitest';

import { runNightlyLegistarSyncCommand } from '../../src/jobs/runNightlyLegistarSync.js';

describe('runNightlyLegistarSyncCommand', () => {
  it('returns and logs a successful sync result', async () => {
    const result = {
      citiesProcessed: 2,
      itemsFound: 5,
      inserted: 3,
      skipped: 2,
      conflictsDetected: 1,
      failures: 0,
    };
    const run = vi.fn().mockResolvedValue(result);
    const log = vi.fn();

    await expect(runNightlyLegistarSyncCommand({ run, log })).resolves.toBe(result);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"failures":0'));
  });

  it('fails when one or more cities fail even though the overall sync completes', async () => {
    const run = vi.fn().mockResolvedValue({ failures: 2 });

    await expect(runNightlyLegistarSyncCommand({ run, log: vi.fn() })).rejects.toThrow(
      'Legistar sync completed with 2 failed city or cities',
    );
  });

  it('propagates an unexpected sync error', async () => {
    const error = new Error('database unavailable');
    const run = vi.fn().mockRejectedValue(error);

    await expect(runNightlyLegistarSyncCommand({ run, log: vi.fn() })).rejects.toBe(error);
  });
});