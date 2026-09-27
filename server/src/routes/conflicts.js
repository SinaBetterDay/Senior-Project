import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth.js';

const router = express.Router();
const reviewStatuses = new Set(['pending', 'confirmed_conflict', 'not_applicable']);

const conflictInclude = {
  politician: { select: { fullName: true, officeTitle: true } },
  agendaItem: { include: { meeting: true } },
};

function serializeConflict(conflict) {
  return {
    id: conflict.id,
    conflictType: conflict.conflictType,
    severity: conflict.severity,
    ruleReference: conflict.ruleReference,
    detectedAt: conflict.detectedAt,
    reviewStatus: conflict.reviewStatus,
    reviewNote: conflict.reviewNote,
    reviewedAt: conflict.reviewedAt,
    politician: conflict.politician,
    agendaItem: conflict.agendaItem,
  };
}

router.get('/', async (_req, res) => {
  try {
    const conflicts = await prisma.conflict.findMany({
      include: conflictInclude,
      orderBy: { detectedAt: 'desc' },
    });
    return res.json(conflicts.map(serializeConflict));
  } catch (error) {
    console.error('[conflicts] list failed:', error);
    return res.status(500).json({ error: 'Failed to load conflicts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const conflict = await prisma.conflict.findUnique({
      where: { id: req.params.id },
      include: conflictInclude,
    });
    if (!conflict) return res.status(404).json({ error: 'Conflict not found' });
    return res.json(serializeConflict(conflict));
  } catch (error) {
    console.error('[conflicts] detail failed:', error);
    return res.status(500).json({ error: 'Failed to load conflict' });
  }
});

router.patch('/:id/review', requireAdmin, async (req, res) => {
  const { status, note } = req.body ?? {};
  const normalizedNote = typeof note === 'string' ? note.trim() : '';

  if (!reviewStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid review status' });
  }
  if (normalizedNote.length < 10) {
    return res.status(400).json({ error: 'Review note must be at least 10 characters' });
  }

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const conflict = await transaction.conflict.findUnique({
        where: { id: req.params.id },
        select: { reviewStatus: true },
      });
      if (!conflict) return null;

      await transaction.conflictReview.create({
        data: {
          conflictId: req.params.id,
          adminUserId: req.user.id,
          oldStatus: conflict.reviewStatus,
          newStatus: status,
          note: normalizedNote,
        },
      });

      return transaction.conflict.update({
        where: { id: req.params.id },
        data: { reviewStatus: status, reviewNote: normalizedNote, reviewedAt: new Date() },
        include: conflictInclude,
      });
    });

    if (!updated) return res.status(404).json({ error: 'Conflict not found' });
    return res.json(serializeConflict(updated));
  } catch (error) {
    console.error('[conflicts] review failed:', error);
    return res.status(500).json({ error: 'Failed to save conflict review' });
  }
});

export default router;
