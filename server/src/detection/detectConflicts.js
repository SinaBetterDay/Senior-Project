import { detectBusinessPositions } from "./detectBusinessPositions.js";
import { detectIncomeGiftsTravel } from "./detectIncomeGiftsTravel.js";
import { detectRealEstate } from "./detectRealEstate.js";
import { persistConflicts } from "./persistConflicts.js";

async function getPrisma(override) {
  if (override) return override;
  const { prisma } = await import("../lib/prisma.js");
  return prisma;
}

function politicianIdFrom(row) {
  return row?.politicianId ?? row?.politician_id ?? row?.filing?.politicianId ?? null;
}

function asScheduleB(row) {
  return {
    politician_id: politicianIdFrom(row),
    property_description: row.propertyDescription ?? row.property_description ?? null,
    city: row.city ?? null,
    county: row.county ?? null,
    fair_market_value: row.fairMarketValue ?? row.fair_market_value ?? null,
  };
}

function asScheduleCde(row) {
  return {
    politician_id: politicianIdFrom(row),
    source_name: row.sourceName ?? row.source_name ?? null,
    amount: row.amount ?? null,
    schedule_type: row.scheduleType ?? row.schedule_type ?? null,
  };
}

function asScheduleA2(row) {
  return {
    politician_id: politicianIdFrom(row),
    entity_name: row.entityName ?? row.entity_name ?? null,
    business_position: row.businessPosition ?? row.business_position ?? null,
  };
}

async function loadRows(delegate) {
  if (!delegate?.findMany) return [];
  return delegate.findMany({
    include: { filing: { select: { politicianId: true } } },
  });
}

export async function detectConflictsForAgendaItems(ids, deps = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { inserted: 0, skipped: 0, totalCandidates: 0 };
  }

  const client = await getPrisma(deps.prisma);
  const items = await client.agendaItem.findMany({
    where: { id: { in: ids } },
  });

  const [properties, sources, positions] = await Promise.all([
    loadRows(client.scheduleBRealEstate),
    loadRows(client.scheduleCdeIncome),
    loadRows(client.scheduleA2BusinessPosition),
  ]);

  const scheduleB = (properties || []).map(asScheduleB);
  const scheduleCde = (sources || []).map(asScheduleCde);
  const scheduleA2 = (positions || []).map(asScheduleA2);

  const matchDeps = deps.matchNamedEntity
    ? { matchNamedEntity: deps.matchNamedEntity }
    : {};

  const candidates = [];
  for (const item of items) {
    candidates.push(...(await detectRealEstate(scheduleB, item)));
    candidates.push(
      ...(await detectIncomeGiftsTravel(scheduleCde, item, matchDeps)),
    );
    candidates.push(
      ...(await detectBusinessPositions(scheduleA2, item, matchDeps)),
    );
  }

  const persisted = await persistConflicts(candidates, { prisma: client });
  return { ...persisted, totalCandidates: candidates.length };
}
