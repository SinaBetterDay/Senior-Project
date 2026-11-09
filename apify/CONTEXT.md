# Apify Actor workspace (`apify/`)

## Role

Standalone TypeScript Actor that discovers a California city government website, finds dated agenda PDF links, and writes normalized records for server ingestion.

## Entry points and flow

- `src/main.ts` calls `run()`.
- `src/runtime.ts` selects Apify storage or local-file mode.
- `src/discovery.ts` resolves city-only input through the CISA `.gov` registry.
- `src/network.ts` validates public network destinations before fetching.
- `src/scraper.ts` validates input, observes robots rules, extracts PDF links/dates, and emits dataset items.
- `.actor/INPUT_SCHEMA.json` and `.actor/actor.json` define the deployed Actor contract.

The server consumes Actor output in `server/src/jobs/runApifyAgendaScrape.js`; keep both sides compatible when changing dataset fields.

## Commands

```bash
cd apify
npm test
npm run build
```

Local execution reads `INPUT.example.json` (or `INPUT_PATH`) and writes ignored runtime data under `storage/`. Do not commit generated `dist/` or storage output.

## Boundaries

- Keep SSRF/DNS protections in `src/network.ts` intact.
- Do not put database writes or server credentials in the Actor.
- The Actor locates documents; PDF parsing and Prisma persistence belong to `server/`.