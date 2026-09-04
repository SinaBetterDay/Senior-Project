# Workspace — Cron + nightly sync

## Role

Schedule **nightly synchronization** (agenda pulls, reprocessing, or digest triggers) using **`node-cron`**.

## Constraints

- Use **`node-cron`** for scheduling.
- **Do not** add **BullMQ**, **Redis**, or similar queue infra for this project unless the team explicitly changes direction.

## Boundaries

- Keep job idempotency and failure handling in **server** code; document Railway deploy implications (single instance vs. multiple).

## Related docs

- `../agenda-ingestion/CONTEXT.md`, `../admin-notifications/CONTEXT.md`
- `server/CONTEXT.md`
