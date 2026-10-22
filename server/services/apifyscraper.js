import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const CITIES = [
  { startUrl: 'https://www.lemongrove.ca.gov/our-government/city-clerk-s-office/city-council-meeting-info/meeting-agenda-archive', cityName: 'City of Lemon Grove' },
  { startUrl: 'https://www.calexico.ca.gov/councilagendas', cityName: 'City of Calexico' },
  // add more cities here as needed
];

export async function scrapeAgendaPDFs({ lookbackDays = 14 } = {}) {
  const results = [];

  for (const city of CITIES) {
    const run = await client.actor(process.env.APIFY_ACTOR_ID).call({
      startUrl: city.startUrl,
      cityName: city.cityName,
      maxDepth: 2,
      maxPages: 200,
      sameDomainOnly: true,
      lookbackDays,
    });

    if (run.status && run.status !== 'SUCCEEDED') {
      throw new Error(`Apify actor ${run.status} for ${city.cityName}: ${run.statusMessage || 'Check the Apify run log.'}`);
    }
    if (!run.defaultDatasetId) {
      throw new Error(`Apify actor run for ${city.cityName} did not return a dataset ID.`);
    }
    const dataset = client.dataset(run.defaultDatasetId);
    for (let offset = 0; ; offset += 1000) {
      const { items = [] } = await dataset.listItems({ limit: 1000, offset });
      if (!Array.isArray(items)) throw new Error(`Apify dataset for ${city.cityName} returned invalid results.`);
      results.push(...items.map((item) => ({
        ...item,
        city_name: item.city_name ?? item.cityName ?? city.cityName,
      })));
      if (items.length < 1000) break;
    }
  }

  return results; // [{ pdf_url, meeting_date, city_name }, ...]
}