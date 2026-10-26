import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = { $queryRaw: vi.fn() };
  return { prisma, default: prisma };
});

import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('health checks', () => {
  it('reports ready when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', database: 'ok' });
  });

  it('reports unavailable without exposing database errors', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database secret detail'));
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable', database: 'error' });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });
});