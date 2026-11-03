import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ role: 'owner', authenticated: true, acceptInvitation: vi.fn(), changeMember: vi.fn(), invitationById: vi.fn(), listAccess: vi.fn(), revokeInvitation: vi.fn(), sendInvitation: vi.fn() }));
vi.mock('../../src/lib/auth.js', () => ({
  requireAuthenticated: (req, res, next) => {
    if (!mocks.authenticated) return res.status(401).json({ error: 'Sign in required' });
    req.user = { id: 'actor' }; next();
  },
  requireAdmin: (req, res, next) => {
    if (!mocks.authenticated) return res.status(401).json({ error: 'Sign in required' });
    req.user = { id: 'actor' }; req.adminMember = { role: mocks.role }; next();
  },
  requireOwner: (req, res, next) => req.adminMember.role === 'owner' ? next() : res.status(403).json({ code: 'owner_required' }),
}));
vi.mock('../../src/lib/adminAccess.js', () => mocks);
import router from '../../src/routes/admin/users.js';
const app = express(); app.use(express.json()); app.use('/users', router);
app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ error: error.publicMessage ?? 'Internal error' }));
const id = '00000000-0000-4000-8000-000000000001';
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'owner'; mocks.authenticated = true; mocks.listAccess.mockResolvedValue({ members: [], invitations: [], audit: [] }); });

it('denies unauthenticated access', async () => {
  mocks.authenticated = false;
  expect((await request(app).get('/users')).status).toBe(401);
  expect(mocks.listAccess).not.toHaveBeenCalled();
});
it.each([['get', '/users'], ['post', '/users/invitations'], ['patch', `/users/${id}`], ['delete', `/users/invitations/${id}`], ['post', `/users/invitations/${id}/resend`]])('denies non-owner %s %s', async (method, path) => {
  mocks.role = 'admin';
  expect((await request(app)[method](path).send({})).status).toBe(403);
  expect(mocks.sendInvitation).not.toHaveBeenCalled();
  expect(mocks.changeMember).not.toHaveBeenCalled();
});
it('allows authenticated invitees without requiring owner access', async () => {
  mocks.role = 'admin'; mocks.acceptInvitation.mockResolvedValue({ role: 'admin' });
  const result = await request(app).post('/users/accept').send({ token: 'opaque-token' });
  expect(result.status).toBe(200);
  expect(mocks.acceptInvitation).toHaveBeenCalledWith({ id: 'actor' }, 'opaque-token');
});
it('lists members and audit history for owners', async () => {
  expect((await request(app).get('/users')).body).toEqual({ data: { members: [], invitations: [], audit: [] } });
});
it('surfaces recorded email delivery failures', async () => {
  mocks.sendInvitation.mockResolvedValue({ status: 'delivery_failed', lastError: 'Check SMTP' });
  const result = await request(app).post('/users/invitations').send({ email: 'staff@example.gov', role: 'admin' });
  expect(result.status).toBe(502);
  expect(result.body.error).toBe('Check SMTP');
});
it('rejects malformed identifiers', async () => {
  expect((await request(app).patch('/users/not-a-uuid').send({ active: false })).status).toBe(400);
  expect(mocks.changeMember).not.toHaveBeenCalled();
});