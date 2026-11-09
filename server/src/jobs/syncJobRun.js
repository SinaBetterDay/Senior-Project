import { prisma } from '../lib/prisma.js';

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const INTERRUPTED_ERROR = 'Run heartbeat expired; marked interrupted during recovery.';

function isUniqueConstraintError(error) {
  return error?.code === 'P2002' || error?.code === '23505';
}

export async function recoverStaleSyncJobRuns({
  prismaClient = prisma,
  jobKey,
  now = new Date(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
} = {}) {
  const where = {
    status: 'running',
    heartbeatAt: { lt: new Date(now.getTime() - staleAfterMs) },
    ...(jobKey ? { jobKey } : {}),
  };
  const staleRuns = await prismaClient.syncJobRun.findMany({
    where,
    select: { id: true },
  });
  let recovered = 0;

  for (const run of staleRuns) {
    const result = await prismaClient.syncJobRun.updateMany({
      where: { id: run.id, ...where },
      data: {
        status: 'interrupted',
        completedAt: now,
        error: INTERRUPTED_ERROR,
      },
    });
    if (result.count === 0) continue;

    recovered += 1;
    await prismaClient.syncLog.updateMany({
      where: { jobRunId: run.id, status: 'running' },
      data: {
        status: 'failed',
        completedAt: now,
        errors: { message: INTERRUPTED_ERROR },
      },
    });
  }

  if (!jobKey) {
    const orphanedLogs = await prismaClient.syncLog.updateMany({
      where: {
        jobRunId: null,
        status: 'running',
        heartbeatAt: { lt: new Date(now.getTime() - staleAfterMs) },
      },
      data: {
        status: 'failed',
        completedAt: now,
        errors: { message: INTERRUPTED_ERROR },
      },
    });
    recovered += orphanedLogs.count;
  }

  return { recovered };
}

export async function runSyncJob(
  jobKey,
  worker,
  {
    prismaClient = prisma,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    hasErrors = () => false,
    log = console,
  } = {},
) {
  await recoverStaleSyncJobRuns({ prismaClient, jobKey, staleAfterMs });

  const startedAt = new Date();
  let run;
  try {
    run = await prismaClient.syncJobRun.create({
      data: {
        jobKey,
        status: 'running',
        startedAt,
        heartbeatAt: startedAt,
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      log.info?.(`[sync] skipped ${jobKey}; another run is still active`);
      return { skipped: true, result: null };
    }
    throw error;
  }

  let heartbeatInFlight = false;
  const heartbeat = setInterval(async () => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    try {
      const heartbeatAt = new Date();
      await prismaClient.syncJobRun.updateMany({
        where: { id: run.id, status: 'running' },
        data: { heartbeatAt },
      });
      await prismaClient.syncLog.updateMany({
        where: { jobRunId: run.id, status: 'running' },
        data: { heartbeatAt },
      });
    } catch (error) {
      log.error?.(`[sync] heartbeat failed for ${jobKey}:`, error);
    } finally {
      heartbeatInFlight = false;
    }
  }, heartbeatIntervalMs);
  heartbeat.unref?.();

  try {
    const result = await worker({ runId: run.id });
    await prismaClient.syncJobRun.update({
      where: { id: run.id },
      data: {
        status: hasErrors(result) ? 'failed' : 'success',
        completedAt: new Date(),
        error: hasErrors(result) ? 'One or more sources failed; see source sync logs.' : null,
      },
    });
    return { skipped: false, result };
  } catch (error) {
    try {
      await prismaClient.syncLog.updateMany({
        where: { jobRunId: run.id, status: 'running' },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errors: { message: error instanceof Error ? error.message : String(error) },
        },
      });
    } catch (recordError) {
      log.error?.(`[sync] could not fail child sync logs for ${jobKey}:`, recordError);
    }
    try {
      await prismaClient.syncJobRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (recordError) {
      log.error?.(`[sync] could not record failed run ${jobKey}:`, recordError);
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}
