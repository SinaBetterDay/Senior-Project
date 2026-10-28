# FAIR — docs workspaces

Cross-cutting “rooms” for **ingestion**, **matching**, **jobs**, and **notifications**. Implementation may span `server/`, `APIs/`, and `supabase/` — each folder below holds **CONTEXT.md** only.

| Workspace | Purpose |
|-----------|---------|
| `form700-ingestion/` | XLSX uploads, schedules A–E & A-2 |
| `agenda-ingestion/` | Legistar JSON, Apify, PDF parsing |
| `entity-resolution/` | Two matching flows and their distinct thresholds |
| `cron-jobs/` | Implemented `node-cron` paths and disabled workflow status |
| `admin-notifications/` | Planned Resend weekly digests (not implemented) |

Start from repo root: **`CLAUDE.md`** and **`DIRECTORY.md`**.
