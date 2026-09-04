# FAIR database schema v2 (Sprint 5)

Source of truth: `server/prisma/schema.prisma`. Migration: `server/prisma/migrations/20260903000000_schema_v2/migration.sql` (generated with `prisma migrate diff --from-empty`, replaces the loose v1 `init.sql`).

Naming: Prisma models/fields are camelCase; every table/column is snake_case via `@@map` / `@map` (decision recorded in `supabase/CONTEXT.md`). All ids are `uuid` with `DEFAULT gen_random_uuid()`.

## Core tables (v1, renamed to snake_case)

| Table | Notable columns | Notes |
|-------|-----------------|-------|
| `jurisdictions` | `name`, `type`, `legistar_client_id` (unique) | |
| `politicians` | `slug` (unique), `full_name`, `office_title`, `party`, `district`, `photo_url`, `external_id`, `jurisdiction_id`, **`needs_review`** (bool, default false) | `needs_review` is set by `findOrCreatePolitician.js` when a filer is auto-created |
| `meetings` | `jurisdiction_id`, `body_name`, `meeting_date`, `agenda_url`, `legistar_event_id` (int) | |
| `agenda_items` | `meeting_id` (**nullable**), `title` (nullable), `description`, `item_number`, **`source_type`** (`legistar`/`apify`/`pdf`, default `legistar`), **`item_text`**, **`city_id`**, `city_name`, `body_name`, `meeting_date`, **`legistar_item_id`** (unique), `legistar_event_id`, `legistar_matter_id`, `agenda_number`, `event_item_passed_flag`, `legistar_item_payload` (jsonb) | Raw ingestion (`nightlySync.js`, `pdfParser.js`) inserts here directly with no `Meeting` row; `ON CONFLICT (legistar_item_id) DO NOTHING` is the Legistar dedup key |
| `vote_records` | `agenda_item_id`, `politician_id`, `vote`, `vote_date` | unique `(agenda_item_id, politician_id)` |
| `form700_filings` | `politician_id`, `filing_year`, **`filer_name`**, **`original_filename`**, **`archived_path`**, `storage_path` (legacy), `filed_at` | unique `(politician_id, filing_year)` → 409 on duplicate year |
| `conflict_flags` | `politician_id`, `agenda_item_id`, `severity`, `status` (default `OPEN`), `summary` | |

## Form 700 schedule tables (new)

All four have `filing_id → form700_filings(id) ON DELETE CASCADE` and `politician_id → politicians(id) ON DELETE CASCADE` (nullable, denormalised for conflict-engine queries).

| Table | Columns | Parser |
|-------|---------|--------|
| `schedule_a_investments` | `entity_name`, `fair_market_value`, `nature_of_investment` | `parsers/scheduleA.js` |
| `schedule_b_realestate` | `property_description`, `city`, `county`, `fair_market_value`, `nature_of_interest` | `parsers/scheduleB.js` |
| `schedule_cde_income` | `schedule_type` (`C`/`D`/`E`), `source_name`, `amount` | `parsers/scheduleCDE.js` |
| `schedule_a2_business_positions` | `entity_name`, `business_position`, `fair_market_value`, `nature_of_investment`, `gross_income_range` | `parsers/scheduleA2.js` (Sprint 5, G6) |

## Ingestion configuration and audit (new)

| Table | Columns | Used by |
|-------|---------|---------|
| `data_sources` | `city_name`, `source_type` (`legistar`/`apify`/`pdf`), `legistar_base_url`, `legistar_client_id`, `apify_actor_id`, `start_url`, `enabled` (default true), `last_synced_at`, `last_error`, `jurisdiction_id` | `nightlySync.js` selects `WHERE source_type = 'legistar' AND enabled`; admin sources page |
| `sync_logs` | `data_source_id`, `source_type`, `status` (`running`/`success`/`failed`), `started_at`, `completed_at`, `items_found`, `items_inserted`, `items_skipped`, `conflicts_detected`, `errors` (jsonb) | nightly cron, manual sync, weekly admin digest |

## Commands

```bash
cd server
npx prisma validate
npx prisma generate
npx prisma migrate deploy   # fresh Supabase DB → all 13 tables
npx prisma db seed          # prisma/seed.js: State of California + 6 sample politicians
```
