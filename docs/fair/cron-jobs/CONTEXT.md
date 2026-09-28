# Workspace — Cron + nightly sync

## Role

Run scheduled synchronization (agenda pulls, reprocessing, or digest triggers).

## Constraints

- Production schedules run in GitHub Actions (`scheduled-legistar-sync.yml` and `scheduled-apify-agendas.yml`) so each run has an execution record and does not depend on an API instance staying alive.
- Keep `CRON_ENABLED=false` on Railway to avoid duplicate work. `node-cron` remains available only when intentionally enabled for local or alternate-host scheduling.
- **Do not** add **BullMQ**, **Redis**, or similar queue infra for this project unless the team explicitly changes direction.

## Boundaries

- Keep jobs idempotent and failure-aware in **server** code. GitHub schedules use UTC and may be delayed, so workflows must be safe to retry and are protected from overlapping runs.

## Related docs

- `../agenda-ingestion/CONTEXT.md`, `../admin-notifications/CONTEXT.md`
- `server/CONTEXT.md`
