import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  conflict: { findUnique: vi.fn(), update: vi.fn() },
  conflictReview: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: db }));

import router from '../../src/routes/admin/conflicts.js';

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = { id: 'admin-1' }; next(); });
app.use('/api/admin/conflicts', router);
const id = 'e62f84af-4b46-4b75-a286-25720a30a453';

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.conflict.findUnique.mockResolvedValue({ id, reviewStatus: 'pending' });
  db.conflict.update.mockImplementation(async ({ data }) => ({ id, ...data }));
  db.conflictReview.create.mockResolvedValue({ id: 'review-1' });
});

describe('admin conflict review', () => {
  it('persists the decision and an audit event', async () => {
    const response = await request(app).post(`/api/admin/conflicts/${id}/review`).send({
      status: 'not_applicable',
      note: 'The disclosed entity is unrelated to the agenda contract.',
    });
    expect(response.status).toBe(200);
    expect(db.conflict.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id },
      data: expect.objectContaining({ reviewStatus: 'not_applicable' }),
    }));
    expect(db.conflictReview.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      conflictId: id, adminUserId: 'admin-1', oldStatus: 'pending', newStatus: 'not_applicable',
    }) });
  });

  it('validates the status and note', async () => {
    expect((await request(app).post(`/api/admin/conflicts/${id}/review`).send({ status: 'dismissed', note: 'x' })).status).toBe(400);
    expect((await request(app).post(`/api/admin/conflicts/${id}/review`).send({ status: 'confirmed_conflict', note: '' })).status).toBe(400);
    expect(db.conflict.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing conflict', async () => {
    db.conflict.findUnique.mockResolvedValue(null);
    const response = await request(app).post(`/api/admin/conflicts/${id}/review`).send({ status: 'pending', note: 'Needs another review.' });
    expect(response.status).toBe(404);
  });
});