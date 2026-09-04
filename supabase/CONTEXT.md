# Supabase workspace — FAIR (`supabase/`)

## Role

**PostgreSQL** (hosted on Supabase), **Auth** (admin-only), **Storage** (Form 700 XLSX archives), and **SQL migrations** / RLS policies.

## Expectations

- **Auth:** single admin email/password; **no** public registration flows in app or policies.
- **Storage:** bucket(s) for raw **Form 700** files; align naming with backend upload routes.
- **Migrations:** the **application schema** is owned by Prisma (`server/prisma/migrations/`, applied with `npx prisma migrate deploy`). `supabase/migrations/` holds only Supabase-specific SQL that Prisma cannot express (Storage buckets, RLS policies, auth config). Document breaking changes in commit messages.

## Naming decision — camelCase Prisma models, snake_case tables (Sprint 5, schema v2)

The team decision, applied in `server/prisma/schema.prisma`:

- **Prisma models and fields stay camelCase** (`Politician.fullName`, `AgendaItem.legistarItemId`, `prisma.form700Filing.create(...)`).
- **Every physical table and column is snake_case.** Every model carries `@@map("snake_case_table")` and every multi-word field carries `@map("snake_case_column")`. Single-word fields (`slug`, `party`, `title`, `enabled`) need no `@map`.
- **Why:** `server/src/jobs/nightlySync.js` (raw SQL via `postgres`), `server/src/ingestion/pdfParser.js` and `server/src/utils/findOrCreatePolitician.js` (Supabase JS) write to `data_sources`, `agenda_items` and `politicians` with snake_case column names. Mapping the Prisma models onto those same names means Prisma code and raw-SQL code hit the **same tables and columns** — there is exactly one set of tables, no views or duplicate tables.
- **Primary keys** are `uuid` columns with a **DB-side default** (`gen_random_uuid()`, via `@default(dbgenerated(...)) @db.Uuid`) instead of Prisma's client-side `uuid()`, so raw SQL / Supabase JS inserts that omit `id` still succeed. `updated_at` columns also carry `DEFAULT now()` for the same reason.
- **Rule for new code:** Prisma code uses the camelCase field names; anything that speaks SQL or Supabase JS uses the snake_case column names from the `@map`s. Never add a table or column without both names being defined in `schema.prisma`.

| Prisma model | Table |
|--------------|-------|
| `Jurisdiction` | `jurisdictions` |
| `Politician` | `politicians` |
| `Meeting` | `meetings` |
| `AgendaItem` | `agenda_items` |
| `VoteRecord` | `vote_records` |
| `Form700Filing` | `form700_filings` |
| `ConflictFlag` | `conflict_flags` |
| `ScheduleAInvestment` | `schedule_a_investments` |
| `ScheduleBRealEstate` | `schedule_b_realestate` |
| `ScheduleCdeIncome` | `schedule_cde_income` (`schedule_type` = `C` / `D` / `E`) |
| `ScheduleA2BusinessPosition` | `schedule_a2_business_positions` |
| `DataSource` | `data_sources` |
| `SyncLog` | `sync_logs` |

## Running migrations

```bash
cd server
npx prisma validate                 # schema sanity check (no DB needed)
npx prisma generate                 # regenerate the client (no DB needed)
npx prisma migrate deploy           # apply server/prisma/migrations/* to DATABASE_URL / DIRECT_URL
npx prisma db seed                  # runs prisma/seed.js — sample jurisdiction + politicians
npx prisma migrate dev --name <x>   # local only: create a new migration after editing schema.prisma
```

`DATABASE_URL` should be the Supabase **pooled** connection string and `DIRECT_URL` the **direct** one (used for migrations). Generate the SQL for a new migration without a DB with `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`.

## Related docs

- Schema v2 tables and columns: `docs/schema_v2.md`
- Backend integration: `server/CONTEXT.md`
- Form uploads: `docs/fair/form700-ingestion/CONTEXT.md`
