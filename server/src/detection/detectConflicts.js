import { detectBusinessPositions } from "./detectBusinessPositions.js";
import { detectIncomeGiftsTravel } from "./detectIncomeGiftsTravel.js";
import { detectInvestments } from "./investments.js";
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

function asScheduleA(row) {
  return {
    politician_id: politicianIdFrom(row),
    entity_name: row.entityName ?? row.entity_name ?? null,
    fair_market_value:
      row.fairMarketValue ?? row.fair_market_value ?? null,
    nature_of_investment:
      row.natureOfInvestment ?? row.nature_of_investment ?? null,
  };
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

async function loadRows(delegate, politicianIds) {
  if (!delegate?.findMany) return [];
  const query = { include: { filing: { select: { politicianId: true } } } };
  if (politicianIds?.length) {
    query.where = {
      OR: [
        { politicianId: { in: politicianIds } },
        { filing: { politicianId: { in: politicianIds } } },
      ],
    };
  }
  return delegate.findMany(query);
}

export async function detectConflictsForAgendaItems(ids, deps = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { inserted: 0, skipped: 0, totalCandidates: 0 };
  }

  const client = await getPrisma(deps.prisma);
  const items = await client.agendaItem.findMany({
    where: { id: { in: ids } },
  });
  const politicianIds = deps.politicianIds?.length
    ? [...new Set(deps.politicianIds)]
    : null;

  const [investments, properties, sources, positions] = await Promise.all([
    loadRows(client.scheduleAInvestment, politicianIds),
    loadRows(client.scheduleBRealEstate, politicianIds),
    loadRows(client.scheduleCdeIncome, politicianIds),
    loadRows(client.scheduleA2BusinessPosition, politicianIds),
  ]);

  const inScope = (row) =>
    !politicianIds ||
    politicianIds.includes(politicianIdFrom(row));
  const scheduleA = (investments || []).filter(inScope).map(asScheduleA);
  const scheduleB = (properties || []).filter(inScope).map(asScheduleB);
  const scheduleCde = (sources || []).filter(inScope).map(asScheduleCde);
  const scheduleA2 = (positions || []).filter(inScope).map(asScheduleA2);

  const matchDeps = deps.matchNamedEntity
    ? { matchNamedEntity: deps.matchNamedEntity }
    : {};

  const candidates = [];
  for (const item of items) {
    candidates.push(
      ...(await detectInvestments(scheduleA, item, matchDeps)),
    );

    candidates.push(...(await detectRealEstate(scheduleB, item)));
    
    candidates.push(
      ...(await detectIncomeGiftsTravel(scheduleCde, item, matchDeps)),
    );
    
    candidates.push(
      ...(await detectBusinessPositions(scheduleA2, item, matchDeps)),
    );
  }

  const persisted = await persistConflicts(candidates, { prisma: client });
  return {
    ...persisted,
    duplicates: persisted.duplicates ?? persisted.skipped ?? 0,
    processedAgendaItems: items.length,
    totalCandidates: candidates.length,
  };
}
