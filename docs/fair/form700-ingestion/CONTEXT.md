# Workspace — Form 700 ingestion

## Role

**Form 700** files are **uploaded by admins** (raw **XLSX** archived in **Supabase Storage**). Parse with **SheetJS** (`xlsx` npm package) and map rows into your DB model per schedule.

## Schedules (domain vocabulary)

| Schedule | Content |
|----------|---------|
| **A** | Investments |
| **B** | Real estate |
| **C** | Income |
| **D** | Gifts |
| **E** | Travel payments |
| **A-2** | Business positions |

## Parsers (`server/src/parsers/`)

All parsers are pure and share one signature — `parseScheduleX(buffer, filingId)` (a Buffer or an already-read SheetJS workbook) → array of **snake_case** rows, no DB writes, `[]` on unreadable input or a missing sheet. `parseCoverPage(buffer)` → `{ filer_name, agency, district, office_title, filing_year }` (nulls when absent; a sheet whose name contains "cover" is used first, then the filer columns repeated on schedule sheets in NetFile-style exports). Sheets are located by name (`schedule a`, `schedule a-2`, `schedule b`, …) and the header row is detected by scanning for known column names, because FPPC exports put section titles above the headers. `server/src/routes/admin/upload.js` inserts all rows in one `prisma.$transaction`.

### A-2 column mapping (`schedule_a2_business_positions`)

| Row field (`parseScheduleA2`) | XLSX column (Schedule A-2 sheet) | Notes |
|---|---|---|
| `entity_name` | `NAME OF BUSINESS ENTITY OR TRUST` | required — rows without it are skipped |
| `business_position` | `YOUR BUSINESS POSITION` | e.g. Owner, Trustee, Co-Owner |
| `fair_market_value` | `FAIR MARKET VALUE` (first/left-most, section 1) | the section-4 FMV column for entity-held property is ignored |
| `nature_of_investment` | `NATURE OF INVESTMENT (if "other," describe)` | |
| `gross_income_range` | `INCLUDE YOUR PRO RATA SHARE OF GROSS INCOME TO ENTITY/TRUST` (section 2) | range string, e.g. `$0 - $499` |
| `filing_id` | — | passed in by the caller |

Headers are matched case-insensitively after collapsing whitespace/line breaks, exact match first then prefix match, so the left-most duplicate header wins. Section 3 (sources of income ≥ $10,000) and section 4 (investments/real property held by the entity) are not ingested yet.

## Boundaries

- Parsing and validation rules belong with **server** code; storage policy with **Supabase Storage** (see `supabase/CONTEXT.md`).
- Do not expose bulk upload or admin endpoints without **Supabase Auth**.

## Related docs

- `server/CONTEXT.md`, `supabase/CONTEXT.md`
- Matching parsed entities: `../entity-resolution/CONTEXT.md`
