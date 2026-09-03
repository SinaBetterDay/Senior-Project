const DEFAULT_WINDOW_DAYS = 30;

function daysAgoIso(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function normalizeLegistarBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    return null;
  }

  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.includes('/v1/')) {
    return trimmed;
  }

  return `${trimmed}/v1`;
}

function resolveCityApiBaseUrl(dataSource) {
  const directBaseUrl =
    dataSource.legistar_base_url ??
    dataSource.base_url ??
    dataSource.api_base_url ??
    dataSource.legistar_url ??
    dataSource.url;

  const normalizedDirect = normalizeLegistarBaseUrl(directBaseUrl);
  if (normalizedDirect) {
    return normalizedDirect;
  }

  const clientId =
    dataSource.legistar_client_id ??
    dataSource.client_id ??
    dataSource.city_slug ??
    dataSource.slug;

  if (!clientId) {
    return null;
  }

  return `https://webapi.legistar.com/v1/${String(clientId).trim()}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Legistar request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

export async function fetchRecentLegistarMeetings(baseUrl, lookbackDays = DEFAULT_WINDOW_DAYS) {
  const windowStartIso = daysAgoIso(lookbackDays);
  const filter = encodeURIComponent(`EventDate ge datetime'${windowStartIso}'`);
  const order = encodeURIComponent('EventDate desc');
  const url = `${baseUrl}/Events?$filter=${filter}&$orderby=${order}`;

  const meetings = await fetchJson(url);
  return Array.isArray(meetings) ? meetings : [];
}

export async function fetchAgendaItemsForMeeting(baseUrl, meetingId) {
  const encodedMeetingId = encodeURIComponent(String(meetingId));
  const url = `${baseUrl}/Events/${encodedMeetingId}/EventItems`;
  const items = await fetchJson(url);
  return Array.isArray(items) ? items : [];
}

export async function fetchLegistarAgendaItemsForDataSource(dataSource, lookbackDays = DEFAULT_WINDOW_DAYS) {
  const baseUrl = resolveCityApiBaseUrl(dataSource);
  if (!baseUrl) {
    throw new Error(
      `Missing Legistar configuration for city "${dataSource.city_name ?? dataSource.name ?? 'unknown'}"`,
    );
  }

  const meetings = await fetchRecentLegistarMeetings(baseUrl, lookbackDays);
  const allItems = [];

  for (const meeting of meetings) {
    const meetingId = meeting.EventId ?? meeting.event_id;
    if (!meetingId) {
      continue;
    }

    const meetingItems = await fetchAgendaItemsForMeeting(baseUrl, meetingId);
    for (const item of meetingItems) {
      allItems.push({
        item,
        meeting,
        meetingId,
      });
    }
  }

  return { baseUrl, meetings, allItems };
}
