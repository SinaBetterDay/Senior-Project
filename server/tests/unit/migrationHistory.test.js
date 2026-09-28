import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../prisma/migrations',
);

async function readMigrations() {
  const names = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(names.map(async (name) => ({
    name,
    sql: await readFile(path.join(migrationsDirectory, name, 'migration.sql'), 'utf8'),
  })));
}

describe('Prisma migration history', () => {
  it('creates conflict dependencies before creating the conflicts table', async () => {
    const migrations = await readMigrations();
    const baselineIndex = migrations.findIndex(({ name }) => name === '20260903000000_schema_v2');
    const conflictMigrations = migrations.filter(({ sql }) => /CREATE TABLE\s+"conflicts"/i.test(sql));

    expect(baselineIndex).toBeGreaterThanOrEqual(0);
    expect(conflictMigrations).toHaveLength(1);
    expect(migrations.indexOf(conflictMigrations[0])).toBeGreaterThan(baselineIndex);
    expect(migrations[baselineIndex].sql).toMatch(/CREATE TABLE\s+"politicians"/i);
    expect(migrations[baselineIndex].sql).toMatch(/CREATE TABLE\s+"agenda_items"/i);
    expect(conflictMigrations[0].sql).toMatch(/REFERENCES\s+"politicians"\("id"\)/i);
    expect(conflictMigrations[0].sql).toMatch(/REFERENCES\s+"agenda_items"\("id"\)/i);
  });
});