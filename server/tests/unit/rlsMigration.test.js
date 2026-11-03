import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../',
);
const schemaPath = path.join(repositoryRoot, 'server/prisma/schema.prisma');
const migrationPaths = [
  'supabase/migrations/20261102190000_enable_application_table_rls.sql',
  'supabase/migrations/20261103010000_sync_job_runs_rls.sql',
].map((relativePath) => path.join(repositoryRoot, relativePath));

function readSqlTables(sql, role) {
  const statements = [...sql.matchAll(/REVOKE ALL ON TABLE([\s\S]*?);/gi)]
    .map(([, statement]) => statement)
    .filter((statement) => new RegExp(`FROM\\s+${role}$`, 'i').test(statement.trim()));
  return statements
    .flatMap((statement) => [...statement.matchAll(/public\."([^"]+)"/g)].map((match) => match[1]))
    .sort();
}

describe('Supabase RLS migration', () => {
  it('enables default-deny RLS and revokes direct access for every Prisma table', async () => {
    const [schema, migrations] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      Promise.all(migrationPaths.map((filePath) => readFile(filePath, 'utf8'))),
    ]);
    const migration = migrations.join('\n');
    const prismaTables = [...schema.matchAll(/@@map\("([^"]+)"\)/g)]
      .map((match) => match[1])
      .sort();
    const enabledTables = [...migration.matchAll(
      /ALTER TABLE public\."([^"]+)" ENABLE ROW LEVEL SECURITY;/g,
    )]
      .map((match) => match[1])
      .sort();

    expect(enabledTables).toEqual(prismaTables);
    expect(readSqlTables(migration, 'PUBLIC')).toEqual(prismaTables);
    expect(readSqlTables(migration, 'anon')).toEqual(prismaTables);
    expect(readSqlTables(migration, 'authenticated')).toEqual(prismaTables);
    expect(migration).not.toMatch(/\bCREATE POLICY\b/i);
  });
});
