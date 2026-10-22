import { ApifyClient } from 'apify-client';
import { prisma } from '../src/lib/prisma.js';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

export async function scrapeAgendaPDFs({ lookbackDays = 14 } = {}) {
  const results = [];
  const sources = await prisma.dataSource.findMany({
    where: { sourceType: 'apify', enabled: true },
    select: { cityName: true, startUrl: true, apifyActorId: true },
    orderBy: { cityName: 'asc' },
  });

  for (const source of sources) {
    const actorId = source.apifyActorId ?? process.env.APIFY_ACTOR_ID;
    if (!actorId) throw new Error(`No Apify actor configured for ${source.cityName}`);
    const run = await client.actor(actorId).call({
      ...(source.startUrl ? { startUrl: source.startUrl } : {}),
      cityName: source.cityName,
      maxDepth: 2,
      maxPages: 200,
      sameDomainOnly: true,
      lookbackDays,
    });

    for (let offset = 0; ; offset += 1000) {
      const { items = [] } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1000, offset });
      results.push(...items);
      if (items.length < 1000) break;
    }
  }

  return results; // [{ pdf_url, meeting_date, city_name }, ...]
}