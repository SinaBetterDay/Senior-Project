import { normalizeEntityName } from "./matchEntity.js";

async function getPrisma(override) {
  if (override) return override;
  const { prisma } = await import("../lib/prisma.js");
  return prisma;
}

export function toConflictRecord(candidate = {}) {
  const politicianId = candidate.politicianId ?? candidate.politician_id;
  const agendaItemId = candidate.agendaItemId ?? candidate.agenda_item_id;
  const conflictType = candidate.conflictType ?? candidate.conflict_type;
  const ruleReference = candidate.ruleReference ?? candidate.rule_reference;
  const entityName = candidate.entityName ?? candidate.entity_name ?? null;
  const sourceKey =
    candidate.sourceKey ??
    candidate.source_key ??
    `${conflictType || ""}:${normalizeEntityName(entityName) || ""}`;
  const detectedAt = candidate.detectedAt ?? candidate.detected_at;

  const record = {
    politicianId,
    agendaItemId,
    conflictType,
    severity: candidate.severity,
    ruleReference,
    entityName,
    sourceKey,
    detectedAt: detectedAt ? new Date(detectedAt) : new Date(),
  };
  return record;
}

export function conflictUniqueKey(candidate) {
  const record = toConflictRecord(candidate);
  return `${record.politicianId}|${record.agendaItemId}|${record.conflictType}|${record.sourceKey}`;
}

export async function persistConflicts(candidates, deps = {}) {
  const rows = [];
  const seen = new Set();

  for (const candidate of candidates || []) {
    const record = toConflictRecord(candidate);
    if (
      !record.politicianId ||
      !record.agendaItemId ||
      !record.conflictType ||
      !record.severity ||
      !record.ruleReference ||
      !record.sourceKey
    ) {
      continue;
    }
    const key = conflictUniqueKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(record);
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const client = await getPrisma(deps.prisma);
  const result = await client.conflict.createMany({
    data: rows,
    skipDuplicates: true,
  });
  const inserted = result?.count ?? 0;
  return { inserted, skipped: rows.length - inserted };
}
