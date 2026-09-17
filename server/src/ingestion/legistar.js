
import { prisma } from "../db.js";
import { fetchLegistarAgendaItemsForDataSource } from "./legistarApi.js";

/**
 * Ingest Legistar data for a single data source
 */
async function ingestSingleSource(source) {
  const { baseUrl, meetings, allItems } =
    await fetchLegistarAgendaItemsForDataSource(source);

  let insertedCount = 0;

  for (const { item, meeting, meetingId } of allItems) {
    await prisma.agenda_items.upsert({
      where: { external_id: String(item.EventItemId) },
      update: {
        meeting_id: meetingId,
        city_id: source.id,
        raw: item
      },
      create: {
        external_id: String(item.EventItemId),
        meeting_id: meetingId,
        city_id: source.id,
        raw: item
      }
    });

    insertedCount++;
  }

  return {
    baseUrl,
    meetingsCount: meetings.length,
    itemsInserted: insertedCount
  };
}

/**
 * Loop through all active Legistar sources.
 * One failing city does NOT stop the rest of the run.
 */
export async function runLegistarIngestion() {
  const sources = await prisma.data_sources.findMany({
    where: { active: true, type: "legistar" }
  });

  const results = {
    startedAt: new Date().toISOString(),
    successes: [],
    failures: []
  };

  for (const source of sources) {
    console.log(`[Legistar Sync] Starting ${source.city_name}`);

    try {
      const result = await ingestSingleSource(source);

      results.successes.push({
        sourceId: source.id,
        city: source.city_name,
        ...result
      });

      console.log(`[Legistar Sync] Success: ${source.city_name}`);
    } catch (err) {
      results.failures.push({
        sourceId: source.id,
        city: source.city_name,
        error: err.message
      });

      console.error(`[Legistar Sync] FAILED: ${source.city_name}`, err);
    }
  }

  results.finishedAt = new Date().toISOString();
  return results;
}
