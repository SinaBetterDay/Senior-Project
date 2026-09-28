import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth.js', () => ({
  requireAdmin: (_req, _res, next) => next(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    dataSource: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    agendaItem: { deleteMany: vi.fn() },
  },
}));

vi.mock('apify-client', () => ({ ApifyClient: vi.fn() }));

import { prisma } from '../../src/lib/prisma.js';
import { ApifyClient } from 'apify-client';
import sourcesRouter from '../../src/routes/admin/sources.js';

const app = express();
app.use(express.json());
app.use('/api/admin/sources', sourcesRouter);

const validSource = {
  cityName: 'Sacramento',
  sourceType: 'Legistar',
  legistarBaseUrl: 'https://webapi.legistar.com/v1/sacramento',
};
const validApifySource = {
  cityName: 'Elk Grove',
  sourceType: 'Apify',
  apifyActorId: '  fair/agenda-scraper  ',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  prisma.dataSource.create.mockImplementation(async ({ data }) => ({ id: 'source-1', ...data }));
  prisma.dataSource.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
  prisma.dataSource.delete.mockResolvedValue({ id: 'source-1' });
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Apify actor validation on save', () => {
  beforeEach(() => {
    vi.stubEnv('APIFY_TOKEN', 'account-token');
  });

  it('checks the actor with the configured account before creating the source', async () => {
    const actorGet = vi.fn().mockResolvedValue({ id: 'fair/agenda-scraper' });
    const actor = vi.fn(() => ({ get: actorGet }));
    ApifyClient.mockImplementation(() => ({ actor }));

    const response = await request(app).post('/api/admin/sources').send(validApifySource);

    expect(response.status).toBe(201);
    expect(ApifyClient).toHaveBeenCalledWith({ token: 'account-token' });
    expect(actor).toHaveBeenCalledWith('fair/agenda-scraper');
    expect(actorGet).toHaveBeenCalledTimes(1);
    expect(prisma.dataSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cityName: 'Elk Grove',
        sourceType: 'apify',
        apifyActorId: 'fair/agenda-scraper',
      }),
    });
  });

  it('rejects actors unavailable to the configured account without creating a source', async () => {
    const actorGet = vi.fn().mockRejectedValue(new Error('Actor not found or not accessible'));
    const actor = vi.fn(() => ({ get: actorGet }));
    ApifyClient.mockImplementation(() => ({ actor }));

    const response = await request(app).post('/api/admin/sources').send(validApifySource);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('configured Apify account');
    expect(response.body.error).toContain('Actor not found or not accessible');
    expect(prisma.dataSource.create).not.toHaveBeenCalled();
  });
});

describe('source edit and delete', () => {
  it('updates a source after validating its new Legistar URL', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [] });

    const response = await request(app)
      .put('/api/admin/sources/source-1')
      .send({ ...validSource, cityName: 'West Sacramento' });

    expect(response.status).toBe(200);
    expect(prisma.dataSource.update).toHaveBeenCalledWith({
      where: { id: 'source-1' },
      data: expect.objectContaining({ cityName: 'West Sacramento', sourceType: 'legistar' }),
    });
  });

  it('deletes only the source configuration and leaves ingested agenda items untouched', async () => {
    const response = await request(app).delete('/api/admin/sources/source-1');

    expect(response.status).toBe(204);
    expect(prisma.dataSource.delete).toHaveBeenCalledWith({ where: { id: 'source-1' } });
    expect(prisma.agendaItem.deleteMany).not.toHaveBeenCalled();
  });
});