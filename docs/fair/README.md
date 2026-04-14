# FAIR — docs workspaces

Cross-cutting “rooms” for **ingestion**, **matching**, **jobs**, and **notifications**. Implementation may span `server/`, `APIs/`, and `supabase/` — each folder below holds **CONTEXT.md** only.

| Workspace | Purpose |
|-----------|---------|
| `form700-ingestion/` | XLSX uploads, schedules A–E & A-2 |
| `agenda-ingestion/` | Legistar JSON, Apify, PDF parsing |
| `entity-resolution/` | `fuse.js` + Gemini band 0.7–0.85 |
| `cron-jobs/` | Nightly sync with `node-cron` |
| `admin-notifications/` | Resend weekly digests |

Start from repo root: **`CLAUDE.md`** and **`DIRECTORY.md`**.
