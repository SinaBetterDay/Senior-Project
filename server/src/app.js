/**
 * Express application (no listener). `index.js` imports this, schedules cron and
 * calls `app.listen`; tests can import `app` directly and drive it with supertest.
 */
import './lib/env.js';
import cors from 'cors';
import express from 'express';

import { requireAdmin } from './lib/auth.js';
import agendaRouter from './routes/agenda.js';
import conflictsRouter from './routes/conflicts.js';
import politiciansRouter from './routes/politicians.js';
import searchRouter from './routes/search.js';
import adminReportsRouter from './routes/admin/reports.js';
import adminSourcesRouter from './routes/admin/sources.js';

export const app = express();

// --- global middleware -----------------------------------------------------
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  }),
);
app.use(express.json());

// --- health ----------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- public API ------------------------------------------------------------
app.use('/api/conflicts', conflictsRouter);
app.use('/api/politicians', politiciansRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/search', searchRouter);

// --- admin API (Supabase JWT required) --------------------------------------
app.use('/api/admin/sources', requireAdmin, adminSourcesRouter);
app.use('/api/admin/reports', requireAdmin, adminReportsRouter);

// TODO(G5): swap in the real router from ./routes/admin/upload.js once the
// Form 700 ingestion repair lands (it currently has syntax errors / broken
// import paths and must not be imported here yet). multer (10 MB) is applied
// inside that router, not globally.
const uploadPlaceholder = express.Router();
uploadPlaceholder.all('*', (_req, res) => {
  res.status(501).json({ error: 'not implemented' });
});
app.use('/api/admin/upload', requireAdmin, uploadPlaceholder);

// --- 404 -------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// --- error handler ---------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : (err?.status ?? 500);
  const isProduction = process.env.NODE_ENV === 'production';

  if (statusCode >= 500 || !isProduction) {
    console.error('[server] unhandled error:', isProduction ? err?.message : err);
  }

  const message =
    statusCode >= 500 && isProduction
      ? 'internal server error'
      : (err?.message ?? 'internal server error');

  const body = { error: message };
  if (!isProduction && err?.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
});

export default app;
