import { ApifyClient } from "apify-client";
import { prisma } from "../lib/prisma.js";
import { getAgendaItems, getMeetings } from "../ingestion/legistarApi.js";

export async function runLegistarSource(source) {
  const meetings = await getMeetings(source.legistarBaseUrl, 50);
  const rows = [];

  for (const meeting of meetings) {
    const meetingId = meeting.EventId ?? meeting.id;
    if (meetingId == null) continue;

    const items = await getAgendaItems(source.legistarBaseUrl, meetingId);
    for (const item of items) {
      const itemId = item.EventItemId ?? item.id;
      if (itemId == null) continue;
      const rawMeetingDate = meeting.EventDate ?? meeting.date ?? null;
      const meetingDate = rawMeetingDate && !Number.isNaN(Date.parse(rawMeetingDate))
        ? new Date(rawMeetingDate)
        : null;

      rows.push({
        sourceType: 'legistar',
        legistarItemId: String(itemId),
        legistarEventId: String(meetingId),
        legistarMatterId: item.MatterId == null ? null : String(item.MatterId),
        cityName: source.cityName,
        title: item.EventItemTitle ?? item.MatterName ?? item.Title ?? item.title ?? 'Untitled agenda item',
        agendaNumber: item.EventItemAgendaNumber ?? item.AgendaNumber ?? null,
        bodyName: meeting.EventBodyName ?? meeting.bodyName ?? null,
        meetingDate,
        eventItemPassedFlag: item.EventItemPassedFlag == null ? null : Boolean(item.EventItemPassedFlag),
        legistarItemPayload: item,
      });
    }
  }

  const result = rows.length
    ? await prisma.agendaItem.createMany({ data: rows, skipDuplicates: true })
    : { count: 0 };
  return {
    itemsFound: rows.length,
    itemsInserted: result.count,
    itemsSkipped: rows.length - result.count,
  };
}

export async function runApifySource(source) {
  if (!process.env.APIFY_TOKEN) throw new Error('Apify is not configured on the server (APIFY_TOKEN is missing).');

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor(source.apifyActorId).call({
    cityName: source.cityName,
    ...(source.startUrl ? { startUrl: source.startUrl } : {}),
  }, { timeout: 600 });
  if (run.status && run.status !== 'SUCCEEDED') throw new Error(`Actor ${run.status}: ${run.statusMessage || 'Check the Apify run log.'}`);
  const items = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await client.dataset(run.defaultDatasetId).listItems({ limit: 1000, offset });
    items.push(...(page.items ?? []));
    if ((page.items?.length ?? 0) < 1000) break;
  }
  const existing = await prisma.agendaItem.findMany({
    where: { cityId: source.id },
    select: { itemText: true },
  });
  const existingItemTexts = new Set(existing.map((item) => item.itemText).filter(Boolean));
  const seenItemTexts = new Set();
  const rows = items.flatMap((item) => {
    const url = item.pdf_url ?? item.pdfUrl ?? item.agenda_url ?? item.url ?? null;
    const title = item.document_title ?? item.title ?? item.agenda_title ?? item.agendaTitle ?? item.name ?? (url ? 'Agenda PDF' : null);
    const itemText = url ?? item.text ?? item.description ?? JSON.stringify(item);
    if (existingItemTexts.has(itemText) || seenItemTexts.has(itemText)) return [];
    seenItemTexts.add(itemText);

    const date = item.meeting_date ?? item.meetingDate ?? null;
    return [{
      sourceType: 'apify',
      cityId: source.id,
      cityName: source.cityName,
      title: String(title ?? 'Untitled agenda item'),
      description: item.description ? String(item.description) : null,
      itemText: String(itemText),
      meetingDate: date && !Number.isNaN(Date.parse(date)) ? new Date(date) : null,
    }];
  });

  if (rows.length) await prisma.agendaItem.createMany({ data: rows });
  return {
    itemsFound: items.length,
    itemsInserted: rows.length,
    itemsSkipped: items.length - rows.length,
  };
}

export async function executeSourceSync(source, syncLogId) {
  try {
    const result =
      source.sourceType.toLowerCase() === "legistar"
        ? await runLegistarSource(source)
        : await runApifySource(source);

    const completedAt = new Date();

    await prisma.$transaction([
      prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "success",
          completedAt,
          itemsFound: result.itemsFound,
          itemsInserted: result.itemsInserted,
          itemsSkipped: result.itemsSkipped,
        },
      }),
      prisma.dataSource.update({
        where: { id: source.id },
        data: { lastSyncedAt: completedAt, lastError: null },
      }),
    ]);
  } catch (error) {
    const completedAt = new Date();

    await prisma.$transaction([
      prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "failed",
          completedAt,
          errors: { message: error.message },
        },
      }),
      prisma.dataSource.update({
        where: { id: source.id },
        data: { lastError: error.message },
      }),
    ]);
  }
}