import { describe, expect, it, vi } from 'vitest';

import { recoverStaleSyncJobRuns, runSyncJob } from '../../src/jobs/syncJobRun.js';

function createRunStore() {
  const runs = [];
  const syncLogs = [];
  let id = 0;
  const matches = (row, where) => (
    (!where.id || row.id === where.id)
    && (!where.jobKey || row.jobKey === where.jobKey)
    && (!where.status || row.status === where.status)
    && (!where.heartbeatAt || row.heartbeatAt < where.heartbeatAt.lt)
    && (!where.jobRunId || row.jobRunId === where.jobRunId)
  );
  const prismaClient = {
    syncJobRun: {
      findMany: vi.fn(async ({ where }) => runs.filter((row) => matches(row, where)).map(({ id: runId }) => ({ id: runId }))),
      create: vi.fn(async ({ data }) => {
        if (runs.some((row) => row.jobKey === data.jobKey && row.status === 'running')) {
          const error = new Error('unique constraint');
          error.code = 'P2002';
          throw error;
        }
        const run = { id: `run-${++id}`, ...data };
        runs.push(run);
        return { id: run.id };
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const selected = runs.filter((row) => matches(row, where));
        selected.forEach((row) => Object.assign(row, data));
        return { count: selected.length };
      }),
      update: vi.fn(async ({ where, data }) => {
        const run = runs.find((row) => row.id === where.id);
        Object.assign(run, data);
        return run;
      }),
    },
    syncLog: {
      updateMany: vi.fn(async ({ where, data }) => {
        const selected = syncLogs.filter((row) => matches(row, where));
        selected.forEach((row) => Object.assign(row, data));
        return { count: selected.length };
      }),
    },
  };
  return { prismaClient, runs, syncLogs };
}

describe('persisted sync-job runs', () => {
  it('skips an overlapping run for the same key and releases the claim after completion', async () => {
    const state = createRunStore();
    let finish;
    let started;
    const workerStarted = new Promise((resolve) => { started = resolve; });
    const firstRun = runSyncJob('legistar', async () => {
      started();
      await new Promise((resolve) => { finish = resolve; });
      return { failures: 0 };
    }, { prismaClient: state.prismaClient });

    await workerStarted;
    await expect(runSyncJob('legistar', vi.fn(), { prismaClient: state.prismaClient }))
      .resolves.toMatchObject({ skipped: true });

    finish();
    await expect(firstRun).resolves.toMatchObject({ skipped: false, result: { failures: 0 } });
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].status).toBe('success');
  });

  it('marks a run and its child sync logs interrupted after a simulated process restart', async () => {
    const state = createRunStore();
    const now = new Date('2026-11-03T12:00:00Z');
    state.runs.push({
      id: 'abandoned-run',
      jobKey: 'apify',
      status: 'running',
      heartbeatAt: new Date(now.getTime() - 6 * 60 * 1000),
    });
    state.syncLogs.push({
      id: 'abandoned-log',
      jobRunId: 'abandoned-run',
      status: 'running',
    });

    await expect(recoverStaleSyncJobRuns({
      prismaClient: state.prismaClient,
      jobKey: 'apify',
      now,
    })).resolves.toEqual({ recovered: 1 });
    expect(state.runs[0]).toMatchObject({
      status: 'interrupted',
      completedAt: now,
    });
    expect(state.syncLogs[0]).toMatchObject({
      status: 'failed',
      completedAt: now,
    });

    const resumed = await runSyncJob('apify', async () => ({ errors: 0 }), {
      prismaClient: state.prismaClient,
    });
    expect(resumed).toMatchObject({ skipped: false, result: { errors: 0 } });
    expect(state.runs.at(-1).status).toBe('success');
  });

  it('records failures while leaving the source key available for a retry', async () => {
    const state = createRunStore();
    const error = new Error('provider unavailable');

    await expect(runSyncJob('apify', async () => { throw error; }, {
      prismaClient: state.prismaClient,
    })).rejects.toBe(error);
    expect(state.runs[0]).toMatchObject({ status: 'failed', error: 'provider unavailable' });

    await expect(runSyncJob('apify', async () => ({ errors: 0 }), {
      prismaClient: state.prismaClient,
    })).resolves.toMatchObject({ skipped: false });
  });
});
