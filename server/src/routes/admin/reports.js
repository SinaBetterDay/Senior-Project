// Admin reports API stub — real implementation is a later sprint.
// Mounted at /api/admin/reports behind requireAdmin in server/src/app.js.
import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.status(501).json({ error: 'not implemented' });
});

export default router;
