import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../',
);
const schemaPath = path.join(repositoryRoot, 'server/prisma/schema.prisma');
const syncJobRunPrismaMigrationPath = path.join(
  repositoryRoot,
  'server/prisma/migrations/20261103000000_persisted_sync_job_runs/migration.sql',
);
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

  it('lets Supabase migrations run before Prisma creates sync_job_runs', async () => {
    const migration = await readFile(migrationPaths[1], 'utf8');

    expect(migration).toMatch(
      /IF\s+to_regclass\('public\.sync_job_runs'\)\s+IS\s+NOT\s+NULL\s+THEN[\s\S]*ALTER TABLE public\."sync_job_runs" ENABLE ROW LEVEL SECURITY;/i,
    );
  });

  it('enables default-deny RLS when Prisma creates sync_job_runs', async () => {
    const migration = await readFile(syncJobRunPrismaMigrationPath, 'utf8');

    expect(migration).toMatch(
      /ALTER TABLE "sync_job_runs" ENABLE ROW LEVEL SECURITY;/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE "sync_job_runs" FROM PUBLIC;/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE "sync_job_runs" FROM anon;/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE "sync_job_runs" FROM authenticated;/i,
    );
  });
});
