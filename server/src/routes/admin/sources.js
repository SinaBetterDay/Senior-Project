// server/src/routes/admin/sources.js
import express from 'express';
import { requireAdmin } from '../../lib/auth.js';
import { ApifyClient } from 'apify-client';
import { prisma } from '../../lib/prisma.js';
import { executeSourceSync as executeSharedSourceSync } from "../../services/sourceSync.js";

const router = express.Router();

function parseLegistarBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid Legistar API base URL.');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'webapi.legistar.com' || !/^\/v1\/[a-z0-9-]+\/?$/i.test(url.pathname)) {
    throw new Error('Use a Legistar API URL such as https://webapi.legistar.com/v1/sacramento.');
  }

  return url.toString().replace(/\/$/, '');
}

async function validateLegistarBaseUrl(value) {
  const baseUrl = parseLegistarBaseUrl(value);
  const response = await fetch(`${baseUrl}/Events?$top=1`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Legistar test request failed (${response.status} ${response.statusText}).`);
  }
  if (!Array.isArray(await response.json())) {
    throw new Error('Legistar returned an unexpected response. Check the API base URL.');
  }
  return baseUrl;
}

async function validateApifyActorId(value) {
  const actorId = typeof value === 'string' ? value.trim() : '';
  if (!actorId) throw new Error('Enter an Apify actor ID.');
  if (!process.env.APIFY_TOKEN) throw new Error('Apify is not configured on the server (APIFY_TOKEN is missing).');

  try {
    const actor = await new ApifyClient({ token: process.env.APIFY_TOKEN }).actor(actorId).get();
    if (!actor) throw new Error('Actor was not found.');
  } catch (error) {
    throw new Error(`Could not access this actor using the configured Apify account: ${error.message}`);
  }
  return actorId;
}

async function validateSourceInput(body) {
  const cityName = typeof body.cityName === 'string' ? body.cityName.trim() : '';
  const sourceType = typeof body.sourceType === 'string'
    ? ['Legistar', 'Apify'].find((type) => type.toLowerCase() === body.sourceType.toLowerCase())
    : null;

  if (!cityName) throw new Error('City name is required.');
  if (!sourceType) throw new Error('Choose Legistar or Apify as the source type.');

  if (sourceType === 'Legistar') {
    return {
      cityName,
      sourceType: 'legistar',
      legistarBaseUrl: await validateLegistarBaseUrl(body.legistarBaseUrl),
      apifyActorId: null,
      startUrl: null,
    };
  }

  return {
    cityName,
    sourceType: 'apify',
    legistarBaseUrl: null,
    apifyActorId: await validateApifyActorId(body.apifyActorId || process.env.APIFY_ACTOR_ID),
    startUrl: validateStartUrl(body.startUrl),
  };
}

function validateStartUrl(value) {
  if (value == null || value === '') return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost') {
    throw new Error('Use a public HTTPS council agenda URL.');
  }
  return url.href;
}

function sendValidationError(res, error) {
  return res.status(400).json({ error: error.message ?? 'Invalid source configuration.' });
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const sources = await prisma.dataSource.findMany({ orderBy: { cityName: 'asc' } });
    const rows = await Promise.all(sources.map(async (source) => {
      const [totalAgendaItems, latestSync] = await Promise.all([
        prisma.agendaItem.count({
          where: {
            OR: [
              { cityId: source.id },
              { cityName: { equals: source.cityName, mode: 'insensitive' } },
            ],
          },
        }),
        prisma.syncLog.findFirst({
          where: { dataSourceId: source.id },
          orderBy: { startedAt: 'desc' },
        }),
      ]);

      return {
        id: source.id,
        cityName: source.cityName,
        sourceType: source.sourceType,
        legistarBaseUrl: source.legistarBaseUrl,
        apifyActorId: source.apifyActorId,
        startUrl: source.startUrl,
        enabled: source.enabled,
        lastSyncTime: source.lastSyncedAt,
        totalAgendaItems,
        lastError: source.lastError,
        status: latestSync?.status ?? (source.enabled ? 'ready' : 'disabled'),
      };
    }));
    return res.json(rows);
  } catch (err) {
    console.error('[admin/sources] failed to load sources', err);
    return res.status(500).json({ error: 'Failed to load sources.' });
  }
});

// Create/reuse a city source and start discovery without waiting for the crawl.
router.post('/discover', requireAdmin, async (req, res) => {
  try {
    const cityName = typeof req.body.cityName === 'string' ? req.body.cityName.trim() : '';
    if (!cityName || cityName.length > 100) return res.status(400).json({ error: 'Enter a California city name (1–100 characters).' });
    const data = await validateSourceInput({ cityName, sourceType: 'Apify', startUrl: req.body.startUrl });
    const existing = await prisma.dataSource.findFirst({ where: { cityName: { equals: cityName, mode: 'insensitive' }, sourceType: 'apify' } });
    if (existing) {
      const active = await prisma.syncLog.findFirst({ where: { dataSourceId: existing.id, status: 'running' } });
      if (active) return res.status(409).json({ error: 'This city already has a running sync.' });
    }
    const source = existing
      ? await prisma.dataSource.update({ where: { id: existing.id }, data: { ...data, startUrl: data.startUrl ?? existing.startUrl, enabled: true } })
      : await prisma.dataSource.create({ data });
    const syncLog = await prisma.syncLog.create({ data: { dataSourceId: source.id, sourceType: 'apify', status: 'running' } });
    void executeSharedSourceSync(source, syncLog.id).catch((error) => console.error('[admin/sources] discovery result persistence failed', error));
    return res.status(202).json({ sourceId: source.id, syncLogId: syncLog.id, status: 'running' });
  } catch (error) {
    return sendValidationError(res, error);
  }
});

router.get('/:id/documents', requireAdmin, async (req, res) => {
  try {
    const rows = await prisma.agendaItem.findMany({
      where: { cityId: req.params.id, sourceType: 'apify' },
      select: { id: true, title: true, itemText: true, meetingDate: true },
      orderBy: { meetingDate: 'desc' }, take: 200,
    });
    return res.json(rows.filter((row) => /^https?:\/\//i.test(row.itemText ?? '')).map((row) => ({
      id: row.id, title: row.title, pdfUrl: row.itemText, meetingDate: row.meetingDate,
    })));
  } catch {
    return res.status(500).json({ error: 'Failed to load agenda documents.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const source = await prisma.dataSource.create({ data: await validateSourceInput(req.body) });
    return res.status(201).json(source);
  } catch (error) {
    return sendValidationError(res, error);
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const source = await prisma.dataSource.update({
      where: { id: req.params.id },
      data: await validateSourceInput(req.body),
    });
    return res.json(source);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Source not found.' });
    return sendValidationError(res, error);
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Agenda items are not deleted with a source; sync-log references use SET NULL.
    await prisma.dataSource.delete({ where: { id: req.params.id } });
    return res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Source not found.' });
    console.error('[admin/sources] failed to delete source', error);
    return res.status(500).json({ error: 'Failed to delete source.' });
  }
});

router.post('/:id/sync', requireAdmin, async (req, res) => {
  try {
    const source = await prisma.dataSource.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: 'Source not found.' });

    const syncLog = await prisma.syncLog.create({
      data: { dataSourceId: source.id, sourceType: source.sourceType.toLowerCase(), status: 'running' },
    });
    void executeSharedSourceSync(source, syncLog.id).catch((error) => {
      console.error('[admin/sources] failed to persist sync result', error);
    });
    return res.status(202).json({ syncLogId: syncLog.id, status: 'running' });
  } catch (error) {
    console.error('[admin/sources] failed to start sync', error);
    return res.status(500).json({ error: 'Failed to start source sync.' });
  }
});

router.get('/:id/sync/:syncLogId', requireAdmin, async (req, res) => {
  try {
    const syncLog = await prisma.syncLog.findFirst({
      where: { id: req.params.syncLogId, dataSourceId: req.params.id },
    });
    if (!syncLog) return res.status(404).json({ error: 'Sync run not found.' });
    return res.json({
      id: syncLog.id,
      status: syncLog.status,
      startedAt: syncLog.startedAt,
      completedAt: syncLog.completedAt,
      itemsFound: syncLog.itemsFound,
      itemsInserted: syncLog.itemsInserted,
      itemsSkipped: syncLog.itemsSkipped,
      error: syncLog.errors?.message ?? null,
    });
  } catch (error) {
    console.error('[admin/sources] failed to load sync status', error);
    return res.status(500).json({ error: 'Failed to load sync status.' });
  }
});

export default router;
