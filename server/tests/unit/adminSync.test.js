import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/jobs/nightlySync.js', () => ({
  runNightlyLegistarSync: vi.fn(),
}));

import { runNightlyLegistarSync } from '../../src/jobs/nightlySync.js';
import adminSyncRouter from '../../src/routes/adminSync.js';

const app = express();
app.use(express.json());
app.use('/api/admin/sync', adminSyncRouter);

describe('manual nightly sync', () => {
  it('delegates to the scheduled Legistar sync workflow', async () => {
    const result = { citiesProcessed: 1, inserted: 2, conflictsDetected: 1 };
    runNightlyLegistarSync.mockResolvedValue(result);

    const response = await request(app).post('/api/admin/sync/run-nightly-sync');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, result });
    expect(runNightlyLegistarSync).toHaveBeenCalledOnce();
  });
});
