import express from 'express';
import { prisma } from '../../lib/prisma.js';

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_STATUSES = new Set(['pending', 'confirmed_conflict', 'not_applicable']);

router.post('/:id/review', async (req, res, next) => {
  const conflictId = req.params.id;
  const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  if (!UUID.test(conflictId)) return res.status(404).json({ error: 'Conflict not found.' });
  if (!REVIEW_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid review status.' });
  }
  if (!note || note.length > 2_000) {
    return res.status(400).json({ error: 'A review note between 1 and 2000 characters is required.' });
  }

  try {
    const existing = await prisma.conflict.findUnique({
      where: { id: conflictId },
      select: { id: true, reviewStatus: true },
    });
    if (!existing) return res.status(404).json({ error: 'Conflict not found.' });

    const reviewedAt = new Date();
    const adminUserId = req.user?.id ?? req.user?.email ?? 'unknown-admin';
    const updated = await prisma.$transaction(async (tx) => {
      const conflict = await tx.conflict.update({
        where: { id: conflictId },
        data: { reviewStatus: status, reviewNote: note, reviewedAt },
        select: { id: true, reviewStatus: true, reviewNote: true, reviewedAt: true },
      });
      await tx.conflictReview.create({
        data: {
          conflictId,
          adminUserId,
          oldStatus: existing.reviewStatus,
          newStatus: status,
          note,
          reviewedAt,
        },
      });
      return conflict;
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

export default router;