import express from 'express';
import { requireAdmin, requireAuthenticated, requireOwner } from '../../lib/auth.js';
import { acceptInvitation, changeMember, invitationById, listAccess, revokeInvitation, sendInvitation } from '../../lib/adminAccess.js';

const router = express.Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.post('/accept', requireAuthenticated, async (req, res, next) => {
  try { res.json({ data: await acceptInvitation(req.user, req.body?.token) }); } catch (error) { next(error); }
});
router.use(requireAdmin, requireOwner);
router.get('/', async (_req, res, next) => {
  try { res.json({ data: await listAccess() }); } catch (error) { next(error); }
});
router.post('/invitations', async (req, res, next) => {
  try {
    const data = await sendInvitation(req.user.id, req.body ?? {});
    res.status(data.status === 'delivery_failed' ? 502 : 201).json({ data, ...(data.status === 'delivery_failed' ? { error: data.lastError } : {}) });
  } catch (error) { next(error); }
});
router.param('id', (req, res, next, id) => uuid.test(id) ? next() : res.status(400).json({ error: 'Invalid user or invitation ID.' }));
router.post('/invitations/:id/resend', async (req, res, next) => {
  try {
    const row = await invitationById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Invitation not found.' });
    const data = await sendInvitation(req.user.id, { id: row.id, email: row.email, role: row.role });
    res.status(data.status === 'delivery_failed' ? 502 : 200).json({ data, ...(data.status === 'delivery_failed' ? { error: data.lastError } : {}) });
  } catch (error) { next(error); }
});
router.delete('/invitations/:id', async (req, res, next) => {
  try { await revokeInvitation(req.user.id, req.params.id); res.json({ data: { revoked: true } }); } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => {
  try { res.json({ data: await changeMember(req.user.id, req.params.id, req.body) }); } catch (error) { next(error); }
});
export default router;