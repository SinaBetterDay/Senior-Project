import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth.js', () => ({
  requireAdmin: (_req, _res, next) => next(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    dataSource: { create: vi.fn() },
  },
}));

vi.mock('apify-client', () => ({ ApifyClient: vi.fn() }));

import { prisma } from '../../src/lib/prisma.js';
import sourcesRouter from '../../src/routes/admin/sources.js';

const app = express();
app.use(express.json());
app.use('/api/admin/sources', sourcesRouter);

const validSource = {
  cityName: 'Sacramento',
  sourceType: 'Legistar',
  legistarBaseUrl: 'https://webapi.legistar.com/v1/sacramento',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  prisma.dataSource.create.mockImplementation(async ({ data }) => ({ id: 'source-1', ...data }));
});

describe('Legistar source validation on save', () => {
  it('tests the Legistar Events endpoint before creating the source', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [] });

    const response = await request(app).post('/api/admin/sources').send(validSource);

    expect(response.status).toBe(201);
    expect(fetch).toHaveBeenCalledWith(
      'https://webapi.legistar.com/v1/sacramento/Events?$top=1',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(prisma.dataSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cityName: 'Sacramento',
        sourceType: 'legistar',
        legistarBaseUrl: 'https://webapi.legistar.com/v1/sacramento',
      }),
    });
  });

  it('rejects malformed base URLs without making a request or creating a source', async () => {
    const response = await request(app)
      .post('/api/admin/sources')
      .send({ ...validSource, legistarBaseUrl: 'https://example.com/not-legistar' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Legistar API URL/);
    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.dataSource.create).not.toHaveBeenCalled();
  });

  it('returns an error and does not create a source when the test request fails', async () => {
    fetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Unavailable' });

    const response = await request(app).post('/api/admin/sources').send(validSource);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Legistar test request failed (503 Unavailable)');
    expect(prisma.dataSource.create).not.toHaveBeenCalled();
  });
});