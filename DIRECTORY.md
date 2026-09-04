# FAIR — routing directory

Use this table to **load only what the task needs**. Avoid dumping the whole repo into one prompt.

| Task | Read first | Usually skip | Tools / libs |
|------|------------|--------------|--------------|
| Public UI, routing, styling | `client/CONTEXT.md`, relevant routes under `client/app/` | `server/`, `APIs/` unless touching API contract | React Router, Tailwind, Vite |
| REST API, middleware, env | `server/CONTEXT.md` | `client/` unless API shape changes | Express, `@supabase/supabase-js` |
| Schema, RLS, migrations, buckets | `supabase/CONTEXT.md` | Frontend components | Supabase SQL, Storage policies |
| Python agenda helpers | `APIs/CONTEXT.md`, `APIs/Agendas/` | `client/` | Legistar / Apify integration notes in CONTEXT |
| Form 700 upload & XLSX schedules | `docs/fair/form700-ingestion/CONTEXT.md`, `server/` | Agenda-only docs | `xlsx` (SheetJS) |
| Legistar JSON / Apify / PDF agendas | `docs/fair/agenda-ingestion/CONTEXT.md` | Form 700-only docs | `pdf-parse`, city-specific scrapers |
| Match officials ↔ interests ↔ agenda | `docs/fair/entity-resolution/CONTEXT.md` | Cron email templates | `fuse.js`, Gemini 1.5 Flash (0.7–0.85 band only) |
| Nightly sync job | `docs/fair/cron-jobs/CONTEXT.md` | Admin email copy | `node-cron` — **not** BullMQ/Redis |
| Weekly admin email | `docs/fair/admin-notifications/CONTEXT.md` | Entity algorithm details | Resend |
| Repo-wide orientation | `CLAUDE.md` | — | — |

## Quick links

- Workspace map: `CLAUDE.md`
- Index of `docs/fair/` workspaces: `docs/fair/README.md`
