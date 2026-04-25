import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

function assertEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing ${name} in server/.env`);
  }
}

/**
 * Runs the Apify actor and returns normalized agenda PDF items:
 * [{ pdf_url, meeting_date, city_name }, ...]
 *
 * Integration point: pass the returned list into your PDF parsing pipeline.
 */
export async function runApifyAgendaScrape({ lookbackDays = 14 } = {}) {
  assertEnv('APIFY_TOKEN');
  assertEnv('APIFY_ACTOR_ID');

  const { scrapeAgendaPDFs } = await import('../../services/apifyscraper.js');
  const items = await scrapeAgendaPDFs({ lookbackDays });

  // TODO: pass `items` into your existing PDF parsing pipeline here.
  // Example shape expected downstream: { pdf_url, meeting_date, city_name }.

  return items;
}

// Allow manual runs: `npm run run:apify-agendas`
if (import.meta.url === `file://${process.argv[1]}`) {
  runApifyAgendaScrape().then(
    (items) => {
      console.log(JSON.stringify(items, null, 2));
      process.exit(0);
    },
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}

