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

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    results.push(...items);
  }

  return results; // [{ pdf_url, meeting_date, city_name }, ...]
}