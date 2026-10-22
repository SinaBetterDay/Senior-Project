import '../lib/env.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ingestApifyAgendaItems, downloadPdf } from '../ingestion/apifyAgenda.js';
import { prisma } from '../lib/prisma.js';

const DEFAULT_LOOKBACK_DAYS = 14;

function assertEnv(name) {
  if (!process.env[name]) throw new Error(`Missing ${name} in server/.env`);
}

function normalizeCityName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export { downloadPdf };

/** Fetch actor datasets, then route all documents through the shared ingestion service. */
export async function runApifyAgendaScrape({
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  city = null,
  prismaClient = prisma,
  scrapeAgendaPDFs,
  parsePdf,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  if (!scrapeAgendaPDFs) {
    assertEnv('APIFY_TOKEN');
    assertEnv('APIFY_ACTOR_ID');
    ({ scrapeAgendaPDFs } = await import('../../services/apifyscraper.js'));
  }

  const actorItems = await scrapeAgendaPDFs({ lookbackDays });
  if (!Array.isArray(actorItems)) throw new Error('Apify dataset results must be an array');

  const requestedCity = normalizeCityName(city).toLowerCase();
  const byCity = new Map();
  let missingCity = 0;

  for (const item of actorItems) {
    const cityName = normalizeCityName(item?.city_name ?? item?.cityName);
    if (requestedCity && cityName.toLowerCase() !== requestedCity) continue;
    if (!cityName) {
      missingCity += 1;
      log('[apify] skipped actor result with no city_name');
      continue;
    }
    const cityItems = byCity.get(cityName) ?? [];
    cityItems.push(item);
    byCity.set(cityName, cityItems);
  }

  const cities = [];
  for (const [cityName, items] of byCity) {
    cities.push(await ingestApifyAgendaItems({
      items,
      source: { cityName, apifyActorId: process.env.APIFY_ACTOR_ID ?? null },
      prismaClient,
      ...(parsePdf ? { parsePdf } : {}),
      fetchImpl,
      log,
    }));
  }

  const totals = cities.reduce((result, summary) => ({
    citiesProcessed: result.citiesProcessed + 1,
    documentsFound: result.documentsFound + summary.documentsFound,
    pdfsFetched: result.pdfsFetched + summary.pdfsFetched,
    documentsSkipped: result.documentsSkipped + summary.documentsSkipped,
    itemsInserted: result.itemsInserted + summary.itemsInserted,
    itemsSkipped: result.itemsSkipped + summary.itemsSkipped,
    errors: result.errors + summary.errors.length,
  }), {
    citiesProcessed: 0,
    documentsFound: 0,
    pdfsFetched: 0,
    documentsSkipped: missingCity,
    itemsInserted: 0,
    itemsSkipped: 0,
    errors: missingCity,
  });

  totals.inserted = totals.itemsInserted;
  totals.skipped = totals.documentsSkipped + totals.itemsSkipped;
  log(`[apify] complete ${JSON.stringify(totals)}`);
  return { ...totals, cities };
}

function readCityArgument(argv) {
  const index = argv.indexOf('--city');
  return index >= 0 ? argv[index + 1] ?? null : null;
}

export async function runApifyAgendaCli({ argv = process.argv.slice(2), run = runApifyAgendaScrape } = {}) {
  const result = await run({ city: readCityArgument(argv) });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors > 0) process.exitCode = 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runApifyAgendaCli().catch((error) => {
    console.error('[apify] command failed:', error);
    process.exitCode = 1;
  });
}
