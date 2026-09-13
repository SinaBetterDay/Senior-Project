import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaPath = new URL('./prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  './prisma/migrations/20260902_add_conflicts_table/migration.sql',
  import.meta.url,
);

test('ConflictFlag defines the requested conflict fields', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  const model = schema.match(/model ConflictFlag \{([\s\S]*?)\n\}/)?.[1];

  assert.ok(model, 'ConflictFlag model should exist');
  for (const field of [
    'politicianId',
    'agendaItemId',
    'conflictType',
    'severity',
    'ruleReference',
    'detectedAt',
  ]) {
    assert.match(model, new RegExp(`^\\s*${field}\\s+`, 'm'), `${field} should exist`);
  }
});

test('conflicts migration creates requested database columns', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  for (const column of [
    'politician_id',
    'agenda_item_id',
    'conflict_type',
    'severity',
    'rule_reference',
    'detected_at',
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`), `${column} should be migrated`);
  }
});