import { getAgendaItems, getMeetings } from "./legistarApi.js";

function sourceBaseUrl(source = {}) {
  return source.legistar_base_url ?? source.legistarBaseUrl ?? source.baseUrl ?? null;
}

function eventId(meeting = {}) {
  return meeting.EventId ?? meeting.event_id ?? meeting.id ?? null;
}

/**
 * Fetch Legistar meetings and their agenda items in the normalized shape used by
 * the schema-v2 nightly sync. Network work stays here; persistence is owned by
 * jobs/nightlySync.js.
 */
export async function fetchLegistarAgendaItemsForDataSource(source, lookbackDays = 30) {
  const baseUrl = sourceBaseUrl(source);
  if (!baseUrl) {
    throw new Error("Legistar data source is missing legistar_base_url");
  }

  const meetings = await getMeetings(baseUrl);
  const minimumDate = new Date();
  minimumDate.setDate(minimumDate.getDate() - lookbackDays);

  const includedMeetings = meetings.filter((meeting) => {
    const date = new Date(meeting.EventDate ?? meeting.event_date ?? meeting.date);
    return Number.isNaN(date.valueOf()) || date >= minimumDate;
  });

  const itemGroups = await Promise.all(
    includedMeetings.map(async (meeting) => {
      const meetingId = eventId(meeting);
      if (meetingId == null) return [];
      const items = await getAgendaItems(baseUrl, meetingId);
      return items.map((item) => ({ item, meeting, meetingId }));
    }),
  );

  return {
    baseUrl,
    meetings: includedMeetings,
    allItems: itemGroups.flat(),
  };
}

/**
 * Backwards-compatible entry point for older callers. The canonical pipeline is
 * now runNightlyLegistarSync, which uses the schema-v2 tables, detects only new
 * agenda items, and records per-source sync logs.
 */
export async function runLegistarIngestion(options = {}) {
  const { runNightlyLegistarSync } = await import("../jobs/nightlySync.js");
  return runNightlyLegistarSync(options);
}
