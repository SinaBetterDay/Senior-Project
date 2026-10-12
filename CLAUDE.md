# FAIR — agent entry point

FAIR (Financial Accountability & Interest Review) compares California Form 700 disclosures with city-council agendas and surfaces **potential** conflicts for human review.

## Read in this order

1. Read `DIRECTORY.md` and choose the task row that matches the request.
2. Read only the listed `CONTEXT.md`, entry points, and nearby tests.
3. Search for symbols before opening more files. Expand context only when an import, route, schema relation, or API contract crosses an area boundary.

Do **not** preload lockfiles, generated output, binary fixtures, Jira CSV exports, or the whole repository. They are indexed in `DIRECTORY.md` but rarely belong in a prompt.

## Stable project facts

- Frontend: React 19 + React Router 7 + Tailwind 4 in `client/`.
- API/jobs: Node.js + Express 4 in `server/`.
- Database: PostgreSQL on Supabase. Prisma owns the application schema in `server/prisma/`; `supabase/migrations/` is only for Supabase-specific Storage/RLS/auth SQL.
- Admin auth: Supabase email/password; there is no public registration flow.
- Agenda ingestion: Legistar for structured sources and the TypeScript Actor in `apify/` for document-only sources.
- Scheduling: `node-cron` is implemented. The checked-in GitHub scheduled-workflow files are disabled; do not describe them as active.
- Notifications: Resend weekly digests are planned/documented but not implemented.

## Source-of-truth rules

- Running code, package scripts, Prisma schema, migrations, and tests outrank prose when they disagree.
- Prisma code uses camelCase model fields; raw SQL and Supabase queries use mapped snake_case names.
- Agenda entity matching uses `0.90` automatic match / `0.70` Gemini minimum in `server/src/config/conflictRules.js`. Politician deduplication separately uses `0.85` / `0.70` in `server/src/utils/findOrCreatePolitician.js`.
- FAIR reports candidates for review; it does not make legal determinations.

## Change expectations

- Follow the nearest `CONTEXT.md` and existing conventions.
- Add or update tests for code changes. Documentation-only changes use `npm run docs:check`.
- Update `README.md` only when setup, usage, architecture, or user-facing capabilities change.
- Never commit secrets or expose server credentials through `VITE_*` variables.

Other agent tools should start at `AGENTS.md`, which points back to this same map without duplicating it.
