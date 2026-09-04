# Backend workspace — FAIR (`server/`)

## Role

**Node.js + Express** API and integration layer: Prisma (when wired), Supabase (DB, Auth, Storage), parsing/matching orchestration, scheduled jobs.

## Stack (target)

- Express, Prisma ORM, PostgreSQL (Supabase).
- **Supabase Auth:** admin login only (no public signup).
- **Supabase Storage:** archive raw **Form 700 XLSX** uploads.
- Parsing: `pdf-parse`, `xlsx` (SheetJS); matching: `fuse.js`; **Gemini 1.5 Flash** for ambiguous matches (fuzzy **0.7–0.85**).
- Email: **Resend** (weekly digests).
- Schedules: **`node-cron`** — **do not** introduce BullMQ/Redis for this project unless explicitly requested.

## Boundaries

- Keep **service role** keys and Gemini/Resend keys **only** on the server.
- Coordinate schema changes with `supabase/CONTEXT.md` and migrations in `supabase/migrations/`.

## Related docs

- Frontend: `client/CONTEXT.md`
- Jobs: `docs/fair/cron-jobs/CONTEXT.md`
- Matching: `docs/fair/entity-resolution/CONTEXT.md`
