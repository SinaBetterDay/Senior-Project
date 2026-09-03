import postgres from 'postgres';
import { fetchLegistarAgendaItemsForDataSource } from '../ingestion/legistar.js';

const DEFAULT_LOOKBACK_DAYS = 30;

function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? null;
}

function getCityName(source) {
  return source.city_name ?? source.name ?? source.id ?? 'unknown-city';
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function toItemInsertRow({ source, meeting, meetingId, item }) {
  return {
    legistar_item_id: String(item.EventItemId ?? item.event_item_id ?? ''),
    legistar_event_id: String(meetingId),
    legistar_matter_id: item.MatterId != null ? String(item.MatterId) : null,
    city_name: getCityName(source),
    title: item.EventItemTitle ?? item.MatterName ?? item.Title ?? 'Untitled Agenda Item',
    agenda_number: item.EventItemAgendaNumber ?? item.EventItemAgendaSequence ?? null,
    body_name: meeting.EventBodyName ?? meeting.EventBodyId ?? null,
    meeting_date: parseDate(meeting.EventDate ?? meeting.event_date),
    event_item_passed_flag:
      item.EventItemPassedFlag == null ? null : Boolean(item.EventItemPassedFlag),
    legistar_item_payload: item,
  };
}

function buildInsertRows(source, fetchedItems) {
  const rows = [];

  for (const fetched of fetchedItems) {
    const itemId = fetched.item.EventItemId ?? fetched.item.event_item_id;
    if (itemId == null) {
      continue;
    }

    rows.push(toItemInsertRow({ ...fetched, source }));
  }

  return rows;
}

function chunk(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function loadDataSourceColumns(sql) {
  const results = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'data_sources'
  `;
  return new Set(results.map((row) => row.column_name));
}

async function loadAgendaItemColumns(sql) {
  const results = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agenda_items'
  `;
  return new Set(results.map((row) => row.column_name));
}

function resolveTypeColumn(dataSourceColumns) {
  if (dataSourceColumns.has('type')) return 'type';
  if (dataSourceColumns.has('source_type')) return 'source_type';
  return null;
}

function resolveEnabledColumn(dataSourceColumns) {
  if (dataSourceColumns.has('enabled')) return 'enabled';
  if (dataSourceColumns.has('is_enabled')) return 'is_enabled';
  if (dataSourceColumns.has('active')) return 'active';
  return null;
}

async function loadLegistarDataSources(sql) {
  const dataSourceColumns = await loadDataSourceColumns(sql);
  const typeColumn = resolveTypeColumn(dataSourceColumns);
  const enabledColumn = resolveEnabledColumn(dataSourceColumns);

  if (!typeColumn) {
    throw new Error('data_sources must include a type-like column (type or source_type)');
  }

  const hasCityName = dataSourceColumns.has('city_name');
  const cityNameExpression = hasCityName ? 'city_name' : 'name AS city_name';
  const enabledCondition = enabledColumn ? `AND ${enabledColumn} = TRUE` : '';

  const query = `
    SELECT id, ${cityNameExpression}, *
    FROM data_sources
    WHERE LOWER(${typeColumn}) = 'legistar'
    ${enabledCondition}
  `;

  return sql.unsafe(query);
}

function rowSubsetByColumns(row, insertColumns) {
  return Object.fromEntries(insertColumns.map((column) => [column, row[column] ?? null]));
}

async function insertAgendaItemRows(sql, rows, agendaItemColumns) {
  if (rows.length === 0) {
    return 0;
  }

  if (!agendaItemColumns.has('legistar_item_id')) {
    throw new Error('agenda_items table must include legistar_item_id column for upsert');
  }

  const insertColumns = [
    'legistar_item_id',
    'legistar_event_id',
    'legistar_matter_id',
    'city_name',
    'title',
    'agenda_number',
    'body_name',
    'meeting_date',
    'event_item_passed_flag',
    'legistar_item_payload',
  ].filter((column) => agendaItemColumns.has(column));

  let insertedCount = 0;
  const rowChunks = chunk(rows, 100);

  for (const rowChunk of rowChunks) {
    const values = rowChunk.map((row) => rowSubsetByColumns(row, insertColumns));
    const result = await sql`
      INSERT INTO agenda_items ${sql(values)}
      ON CONFLICT (legistar_item_id) DO NOTHING
      RETURNING legistar_item_id
    `;

    insertedCount += result.length;
  }

  return insertedCount;
}

async function runLegistarSyncForCityWithSql(sql, dataSource, agendaItemColumns, options = {}) {
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const cityName = getCityName(dataSource);

  const { meetings, allItems } = await fetchLegistarAgendaItemsForDataSource(dataSource, lookbackDays);
  const rows = buildInsertRows(dataSource, allItems);
  const inserted = await insertAgendaItemRows(sql, rows, agendaItemColumns);
  const skipped = rows.length - inserted;

  console.log(
    `[cron][legistar] city="${cityName}" items_found=${rows.length} inserted=${inserted} skipped=${skipped}`,
  );

  return {
    cityName,
    meetingsFound: meetings.length,
    meetingFetched: meetings.length,
    itemsFound: rows.length,
    inserted,
    itemsInserted: inserted,
    skipped,
    itemsSkipped: skipped,
  };
}

export async function runLegistarSyncForCity(sqlOrConfig, dataSource, agendaItemColumns, options = {}) {
  if (typeof sqlOrConfig?.unsafe === 'function') {
    return runLegistarSyncForCityWithSql(sqlOrConfig, dataSource, agendaItemColumns, options);
  }

  const config = sqlOrConfig ?? {};
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL (or DIRECT_URL) for Legistar sync');
  }

  const sql = postgres(databaseUrl, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    const inferredSource = {
      city_name: config.cityName ?? config.name ?? 'Legistar City',
      legistar_base_url: config.baseUrl ?? config.legistarBaseUrl,
      legistar_client_id: config.clientId ?? config.legistarClientId,
    };
    const columns = await loadAgendaItemColumns(sql);
    return runLegistarSyncForCityWithSql(sql, inferredSource, columns, config);
  } finally {
    await sql.end();
  }
}

export async function runNightlyLegistarSync(options = {}) {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL (or DIRECT_URL) for nightly Legistar sync');
  }

  const sql = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    const [dataSources, agendaItemColumns] = await Promise.all([
      loadLegistarDataSources(sql),
      loadAgendaItemColumns(sql),
    ]);

    const totals = {
      citiesProcessed: 0,
      itemsFound: 0,
      inserted: 0,
      skipped: 0,
      failures: 0,
    };

    for (const source of dataSources) {
      try {
        const result = await runLegistarSyncForCityWithSql(sql, source, agendaItemColumns, options);
        totals.citiesProcessed += 1;
        totals.itemsFound += result.itemsFound;
        totals.inserted += result.inserted;
        totals.skipped += result.skipped;
      } catch (error) {
        totals.failures += 1;
        console.error(`[cron][legistar] city="${getCityName(source)}" failed:`, error.message);
      }
    }

    console.log(
      `[cron][legistar] complete cities=${totals.citiesProcessed} failures=${totals.failures} items_found=${totals.itemsFound} inserted=${totals.inserted} skipped=${totals.skipped}`,
    );

    return totals;
  } finally {
    await sql.end();
  }
}
