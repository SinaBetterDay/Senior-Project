// Public API stub — full implementation is Sprint 6.
// Mounted at /api/conflicts in server/src/app.js.
import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.status(200).json({ data: [], note: 'not implemented — Sprint 6' });
});

export default router;
