# Workspace — Agenda ingestion

## Role

Ingest **city council agendas** for cross-reference with Form 700 data.

## Sources

1. **Legistar REST API** — structured JSON for cities that use it.
2. **Apify** — scraping where agendas exist only as **PDF** or non-Legistar pages.
3. **PDF parsing** — `pdf-parse` (npm) when the artifact is a PDF.

## Boundaries

- City-specific quirks (URLs, selectors, Legistar endpoints) should be documented next to the code that uses them.
- Normalize to a **common internal shape** before entity matching (see `../entity-resolution/CONTEXT.md`).

## Related docs

- `APIs/CONTEXT.md` (Python/helpers), `server/CONTEXT.md`
- `../cron-jobs/CONTEXT.md` for nightly pulls
