import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../',
);
const schemaPath = path.join(repositoryRoot, 'server/prisma/schema.prisma');
const migrationPath = path.join(
  repositoryRoot,
  'supabase/migrations/20261102190000_enable_application_table_rls.sql',
);

function readSqlTables(sql, statementPattern) {
  const statement = sql.match(statementPattern)?.[1];
  return statement
    ? [...statement.matchAll(/public\."([^"]+)"/g)].map((match) => match[1]).sort()
    : [];
}

describe('Supabase RLS migration', () => {
  it('enables default-deny RLS and revokes direct access for every Prisma table', async () => {
    const [schema, migration] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(migrationPath, 'utf8'),
    ]);
    const prismaTables = [...schema.matchAll(/@@map\("([^"]+)"\)/g)]
      .map((match) => match[1])
      .sort();
    const enabledTables = [...migration.matchAll(
      /ALTER TABLE public\."([^"]+)" ENABLE ROW LEVEL SECURITY;/g,
    )]
      .map((match) => match[1])
      .sort();

    expect(enabledTables).toEqual(prismaTables);
    expect(readSqlTables(
      migration,
      /REVOKE ALL ON TABLE([\s\S]*?)FROM PUBLIC;/i,
    )).toEqual(prismaTables);
    expect(readSqlTables(
      migration,
      /IF EXISTS \(SELECT FROM pg_roles WHERE rolname = 'anon'\) THEN([\s\S]*?)END IF;/i,
    )).toEqual(prismaTables);
    expect(readSqlTables(
      migration,
      /IF EXISTS \(SELECT FROM pg_roles WHERE rolname = 'authenticated'\) THEN([\s\S]*?)END IF;/i,
    )).toEqual(prismaTables);
    expect(migration).not.toMatch(/\bCREATE POLICY\b/i);
  });
});
