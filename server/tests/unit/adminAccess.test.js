import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptInvitation, changeMember, hashInvitation, membershipFor, revokeInvitation, sendInvitation } from '../../src/lib/adminAccess.js';

const owner = { userId: 'owner', email: 'owner@example.gov', role: 'owner', active: true };
const verified = { id: 'owner', email: 'OWNER@example.gov', email_confirmed_at: '2026-01-01' };
let db;
beforeEach(() => {
  vi.stubEnv('FAIR_ADMIN_EMAIL', 'owner@example.gov');
  vi.stubEnv('CLIENT_ORIGIN', 'https://fair.example.gov');
  db = { $executeRaw: vi.fn().mockResolvedValue(1),
    adminMember: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(owner), count: vi.fn().mockResolvedValue(0), update: vi.fn().mockResolvedValue(owner) },
    adminAccessState: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    adminAccessAudit: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    adminInvitation: { findUnique: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'invitation' }), update: vi.fn(), updateMany: vi.fn() },
  };
  db.$transaction = vi.fn(async fn => fn(db));
});
afterEach(() => vi.unstubAllEnvs());

describe('membership bootstrap', () => {
  it('bootstraps only the verified configured account once under the shared lock', async () => {
    expect(await membershipFor(verified, db)).toEqual(owner);
    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(db.adminAccessState.create).toHaveBeenCalledWith({ data: { id: 1 } });
    expect(db.adminAccessAudit.create.mock.calls[0][0].data.action).toBe('owner_bootstrapped');
  });
  it.each([{ ...verified, email_confirmed_at: null }, { ...verified, email: 'other@example.gov' }])('does not bootstrap an unauthorized or unverified account', async user => {
    expect(await membershipFor(user, db)).toBeNull();
    expect(db.adminMember.create).not.toHaveBeenCalled();
  });
  it('never uses the bootstrap email as a bypass after initialization', async () => {
    db.adminAccessState.findUnique.mockResolvedValue({ id: 1 });
    expect(await membershipFor(verified, db)).toBeNull();
    expect(db.adminMember.create).not.toHaveBeenCalled();
  });
  it('never restores a disabled bootstrap owner', async () => {
    db.adminMember.findUnique.mockResolvedValue({ ...owner, active: false });
    expect(await membershipFor(verified, db)).toBeNull();
    expect(db.adminMember.create).not.toHaveBeenCalled();
  });
  it('does not require the bootstrap variable for an existing active member', async () => {
    vi.stubEnv('FAIR_ADMIN_EMAIL', ''); db.adminMember.findUnique.mockResolvedValue(owner);
    expect(await membershipFor(verified, db)).toEqual(owner);
  });
  it('fails closed before initialization if the bootstrap email is missing', async () => {
    vi.stubEnv('FAIR_ADMIN_EMAIL', '');
    await expect(membershipFor(verified, db)).rejects.toMatchObject({ status: 503 });
  });
});

describe('membership mutations', () => {
  beforeEach(() => { db.adminMember.findUnique.mockResolvedValue(owner); });
  it.each([{ active: false }, { role: 'admin' }])('protects the last active owner', async changes => {
    db.adminMember.count.mockResolvedValue(1);
    await expect(changeMember('owner', 'owner', changes, db)).rejects.toMatchObject({ status: 409 });
    expect(db.adminMember.update).not.toHaveBeenCalled();
  });
  it('allows demotion when another active owner remains and records attribution', async () => {
    db.adminMember.count.mockResolvedValue(2);
    await changeMember('owner', 'owner', { role: 'admin' }, db);
    expect(db.adminMember.update).toHaveBeenCalledOnce();
    expect(db.adminAccessAudit.create.mock.calls[0][0].data.actorId).toBe('owner');
  });
  it('rechecks the actor inside the mutation transaction', async () => {
    db.adminMember.findUnique.mockResolvedValue({ ...owner, role: 'admin' });
    await expect(changeMember('owner', 'other', { active: false }, db)).rejects.toMatchObject({ status: 403 });
  });
  it('rejects unknown fields or malformed roles', async () => {
    await expect(changeMember('owner', 'other', { role: 'superuser' }, db)).rejects.toMatchObject({ status: 400 });
    await expect(changeMember('owner', 'other', { email: 'x' }, db)).rejects.toMatchObject({ status: 400 });
  });
  it('serializes concurrent demotions so at least one active owner remains', async () => {
    const members = [{ ...owner }, { ...owner, userId: 'second' }];
    let queue = Promise.resolve();
    db.$transaction.mockImplementation(fn => {
      const result = queue.then(() => fn(db)); queue = result.catch(() => {}); return result;
    });
    db.adminMember.findUnique.mockImplementation(async ({ where }) => members.find(member => member.userId === where.userId));
    db.adminMember.count.mockImplementation(async () => members.filter(member => member.active && member.role === 'owner').length);
    db.adminMember.update.mockImplementation(async ({ where, data }) => Object.assign(members.find(member => member.userId === where.userId), data));
    const results = await Promise.allSettled([changeMember('owner', 'owner', { role: 'admin' }, db), changeMember('second', 'second', { role: 'admin' }, db)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(members.filter(member => member.role === 'owner')).toHaveLength(1);
  });
});

describe('invitation delivery', () => {
  let auth;
  beforeEach(() => {
    db.adminMember.findUnique.mockImplementation(async ({ where }) => where.userId === 'owner' ? owner : null);
    auth = { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({ error: null }) }, resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }) };
    db.adminInvitation.findUnique.mockResolvedValue({ id: 'invitation', status: 'pending' });
  });
  it('stores only a digest and sends the opaque acceptance token through the email redirect', async () => {
    await sendInvitation('owner', { email: 'New@example.gov', role: 'admin' }, db, auth);
    const data = db.adminInvitation.create.mock.calls[0][0].data;
    const redirect = new URL(auth.admin.inviteUserByEmail.mock.calls[0][1].redirectTo);
    expect(data.email).toBe('new@example.gov');
    expect(data.tokenHash).toBe(hashInvitation(redirect.searchParams.get('invitation')));
    expect(data).not.toHaveProperty('token');
    expect(db.adminMember.create).not.toHaveBeenCalled();
  });
  it('uses recovery email for an existing Supabase account without resetting its password itself', async () => {
    auth.admin.inviteUserByEmail.mockResolvedValue({ error: { code: 'email_exists' } });
    await sendInvitation('owner', { email: 'new@example.gov', role: 'admin' }, db, auth);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('new@example.gov', expect.objectContaining({ redirectTo: expect.stringContaining('/admin/account?invitation=') }));
  });
  it('records delivery failure without granting membership or exposing provider errors', async () => {
    auth.admin.inviteUserByEmail.mockRejectedValue(new Error('secret provider detail'));
    await sendInvitation('owner', { email: 'new@example.gov', role: 'admin' }, db, auth);
    const update = db.adminInvitation.updateMany.mock.calls[0][0];
    expect(update.data.status).toBe('delivery_failed');
    expect(update.data.lastError).not.toContain('secret');
    expect(db.adminMember.create).not.toHaveBeenCalled();
  });
  it('reports a partial failure if email sent but status persistence fails', async () => {
    db.adminInvitation.updateMany.mockRejectedValue(new Error('DB unavailable'));
    await expect(sendInvitation('owner', { email: 'new@example.gov', role: 'admin' }, db, auth)).rejects.toMatchObject({ status: 503 });
    expect(auth.admin.inviteUserByEmail).toHaveBeenCalledOnce();
  });
  it('rate limits invitation requests before sending mail', async () => {
    db.adminAccessAudit.count.mockResolvedValue(10);
    await expect(sendInvitation('owner', { email: 'new@example.gov', role: 'admin' }, db, auth)).rejects.toMatchObject({ status: 429 });
    expect(auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });
  it('rejects duplicate invitations', async () => {
    db.adminInvitation.findFirst.mockResolvedValue({ id: 'previous' });
    await expect(sendInvitation('owner', { email: 'new@example.gov', role: 'admin' }, db, auth)).rejects.toMatchObject({ status: 409 });
  });
  it('rotates the token on resend so old links no longer match', async () => {
    db.adminInvitation.findUnique.mockResolvedValue({ id: 'previous', email: 'new@example.gov', status: 'pending', updatedAt: new Date(0) });
    db.adminInvitation.update.mockResolvedValue({ id: 'previous' });
    await sendInvitation('owner', { id: 'previous', email: 'new@example.gov', role: 'admin' }, db, auth);
    expect(db.adminInvitation.update.mock.calls[0][0].data.tokenHash).toHaveLength(64);
    expect(db.adminInvitation.create).not.toHaveBeenCalled();
  });
});

describe('invitation acceptance and revocation', () => {
  const token = 'a'.repeat(43);
  let invitation;
  beforeEach(() => {
    invitation = { id: 'invitation', email: 'new@example.gov', role: 'admin', status: 'pending', expiresAt: new Date(Date.now() + 60000), invitedBy: 'owner' };
    db.adminInvitation.findUnique.mockResolvedValue(invitation);
    db.adminMember.findUnique.mockImplementation(async ({ where }) => where.userId === 'owner' ? owner : null);
  });
  it('creates membership only for the matching verified user and consumes the invitation', async () => {
    await acceptInvitation({ id: 'new', email: 'new@example.gov', email_confirmed_at: '2026-01-01' }, token, db);
    expect(db.adminMember.create.mock.calls[0][0].data).toMatchObject({ userId: 'new', role: 'admin', grantedBy: 'owner' });
    expect(db.adminInvitation.update).toHaveBeenCalledWith({ where: { id: 'invitation' }, data: { status: 'accepted' } });
  });
  it.each(['revoked', 'accepted', 'delivery_failed', 'sending'])('rejects %s invitations', async status => {
    invitation.status = status;
    await expect(acceptInvitation(verified, token, db)).rejects.toMatchObject({ status: 410 });
  });
  it('rejects expired invitations', async () => {
    invitation.expiresAt = new Date(0);
    await expect(acceptInvitation(verified, token, db)).rejects.toMatchObject({ status: 410 });
  });
  it('rejects a different email or an unverified email', async () => {
    await expect(acceptInvitation(verified, token, db)).rejects.toMatchObject({ status: 403 });
    await expect(acceptInvitation({ id: 'new', email: 'new@example.gov' }, token, db)).rejects.toMatchObject({ status: 403 });
    expect(db.adminMember.create).not.toHaveBeenCalled();
  });
  it('does not reactivate an existing disabled member through invitations', async () => {
    db.adminMember.findUnique.mockResolvedValue({ ...owner, active: false });
    await expect(acceptInvitation({ id: 'new', email: 'new@example.gov', email_confirmed_at: 'date' }, token, db)).rejects.toMatchObject({ status: 409 });
  });
  it('rejects invitations whose inviter is no longer an owner', async () => {
    db.adminMember.findUnique.mockResolvedValue(null);
    await expect(acceptInvitation({ id: 'new', email: 'new@example.gov', email_confirmed_at: 'date' }, token, db)).rejects.toMatchObject({ status: 403 });
  });
  it('records revocation under the same permission lock', async () => {
    await revokeInvitation('owner', 'invitation', db);
    expect(db.adminInvitation.update).toHaveBeenCalledWith({ where: { id: 'invitation' }, data: { status: 'revoked' } });
  });
});