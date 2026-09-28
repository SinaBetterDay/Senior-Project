import '../lib/env.js';
import { parsePdfAgenda } from '../ingestion/pdfParser.js';
import { prisma } from '../lib/prisma.js';

const DEFAULT_LOOKBACK_DAYS = 14;
const PDF_DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function assertEnv(name) {
  if (!process.env[name]) throw new Error(`Missing ${name} in server/.env`);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMeetingDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function normalizeActorItem(item) {
  return {
    pdfUrl: normalizeString(item?.pdf_url ?? item?.pdfUrl ?? item?.url),
    cityName: normalizeString(item?.city_name ?? item?.cityName),
    meetingDate: normalizeMeetingDate(item?.meeting_date ?? item?.meetingDate),
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function downloadPdf(
  pdfUrl,
  { fetchImpl = fetch, timeoutMs = PDF_DOWNLOAD_TIMEOUT_MS, maxBytes = MAX_PDF_BYTES } = {},
) {
  const response = await fetchImpl(pdfUrl, {
    headers: { Accept: 'application/pdf' },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`PDF download failed (${response.status} ${response.statusText})`);
  }

  const contentLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`PDF exceeds ${Math.floor(maxBytes / 1024 / 1024)} MB limit`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`PDF exceeds ${Math.floor(maxBytes / 1024 / 1024)} MB limit`);
  }
  return buffer;
}

async function findOrCreateDataSource(prismaClient, cityName) {
  const existing = await prismaClient.dataSource.findFirst({
    where: { cityName, sourceType: 'apify' },
  });
  if (existing) return existing;

  return prismaClient.dataSource.create({
    data: {
      cityName,
      sourceType: 'apify',
      apifyActorId: process.env.APIFY_ACTOR_ID ?? null,
    },
  });
}

async function upsertAgendaRows(prismaClient, rows, cityName) {
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const key = {
      cityId: row.cityId,
      meetingDate: row.meetingDate,
      itemNumber: row.itemNumber,
    };
    const where = { cityId_meetingDate_itemNumber: key };
    const existing = await prismaClient.agendaItem.findUnique({ where, select: { id: true } });
    const data = { ...row, cityName };

    await prismaClient.agendaItem.upsert({ where, create: data, update: data });
    if (existing) skipped += 1;
    else inserted += 1;
  }

  return { inserted, skipped };
}

async function processCityItems({ cityName, items, prismaClient, parsePdf, fetchImpl, log }) {
  const source = await findOrCreateDataSource(prismaClient, cityName);
  const syncLog = await prismaClient.syncLog.create({
    data: {
      dataSourceId: source.id,
      sourceType: 'apify',
      status: 'running',
      startedAt: new Date(),
      itemsFound: items.length,
    },
  });
  let inserted = 0;
  let skipped = 0;
  const errors = [];

  for (const item of items) {
    try {
      if (!item.pdfUrl) throw new Error('Actor item is missing pdf_url');
      if (!item.meetingDate) throw new Error('Actor item has an invalid or missing meeting_date');

      const buffer = await downloadPdf(item.pdfUrl, { fetchImpl });
      const rows = await parsePdf(buffer, source.id, item.meetingDate);
      if (rows.length === 0) throw new Error('PDF contained no parseable agenda text');

      const result = await upsertAgendaRows(prismaClient, rows, cityName);
      inserted += result.inserted;
      skipped += result.skipped;
    } catch (error) {
      skipped += 1;
      const detail = { pdfUrl: item.pdfUrl || null, message: errorMessage(error) };
      errors.push(detail);
      log(`[cron][apify] city="${cityName}" skipped pdf="${item.pdfUrl || 'unknown'}": ${detail.message}`);
    }
  }

  const completedAt = new Date();
  const lastError = errors.length > 0 ? errors.map((entry) => entry.message).join('; ') : null;
  await prismaClient.$transaction([
    prismaClient.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: errors.length === items.length && items.length > 0 ? 'failed' : 'success',
        completedAt,
        itemsFound: items.length,
        itemsInserted: inserted,
        itemsSkipped: skipped,
        errors: errors.length > 0 ? errors : null,
      },
    }),
    prismaClient.dataSource.update({
      where: { id: source.id },
      data: { lastSyncedAt: completedAt, lastError },
    }),
  ]);

  return { cityName, pdfsFetched: items.length, inserted, skipped, errors };
}

/** Run the full Apify → PDF → agenda_items ingestion pipeline. */
export async function runApifyAgendaScrape({
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  city = null,
  prismaClient = prisma,
  scrapeAgendaPDFs,
  parsePdf = parsePdfAgenda,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  if (!scrapeAgendaPDFs) {
    assertEnv('APIFY_TOKEN');
    assertEnv('APIFY_ACTOR_ID');
    ({ scrapeAgendaPDFs } = await import('../../services/apifyscraper.js'));
  }

  const actorItems = await scrapeAgendaPDFs({ lookbackDays });
  const requestedCity = normalizeString(city).toLowerCase();
  const normalized = actorItems.map(normalizeActorItem).filter((item) => (
    !requestedCity || item.cityName.toLowerCase() === requestedCity
  ));
  const missingCity = normalized.filter((item) => !item.cityName);
  const byCity = new Map();

  for (const item of normalized.filter((entry) => entry.cityName)) {
    const items = byCity.get(item.cityName) ?? [];
    items.push(item);
    byCity.set(item.cityName, items);
  }

  const cities = [];
  for (const [cityName, items] of byCity) {
    cities.push(await processCityItems({ cityName, items, prismaClient, parsePdf, fetchImpl, log }));
  }

  const totals = cities.reduce((result, summary) => ({
    citiesProcessed: result.citiesProcessed + 1,
    pdfsFetched: result.pdfsFetched + summary.pdfsFetched,
    inserted: result.inserted + summary.inserted,
    skipped: result.skipped + summary.skipped,
    errors: result.errors + summary.errors.length,
  }), {
    citiesProcessed: 0,
    pdfsFetched: 0,
    inserted: 0,
    skipped: missingCity.length,
    errors: missingCity.length,
  });

  log(`[cron][apify] complete ${JSON.stringify(totals)}`);
  return { ...totals, cities };
}

function readCityArgument(argv) {
  const index = argv.indexOf('--city');
  return index >= 0 ? argv[index + 1] ?? null : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runApifyAgendaScrape({ city: readCityArgument(process.argv.slice(2)) }).then(
    (result) => {
      console.log(JSON.stringify(result, null, 2));
      if (result.errors > 0) process.exitCode = 1;
    },
    (error) => {
      console.error('[cron][apify] command failed:', error);
      process.exitCode = 1;
    },
  );
}