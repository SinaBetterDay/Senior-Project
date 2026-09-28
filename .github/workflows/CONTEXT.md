# GitHub Actions — FAIR (`.github/workflows/`)

## Role

CI and scheduled maintenance workflows for the monorepo.

- **`test` job** — runs on every PR to `dev` / `main` and on push to `main`. Spins up a `postgres:15` service, then in `server/`: `npm ci` → `npx prisma generate` → `npx prisma migrate deploy` → `npm test` (vitest, `tests/unit`). `DATABASE_URL` and `DIRECT_URL` both point at the service container.
- **`scheduled-legistar-sync.yml`** — runs `npm run sync:legistar` daily at 02:00 UTC or manually. Requires repository secrets `DATABASE_URL` and `DIRECT_URL`.
- **`scheduled-apify-agendas.yml`** — runs the full Apify → PDF → database ingestion path Mondays at 03:10 UTC or manually. Requires repository secrets `APIFY_TOKEN`, `DATABASE_URL`, and `DIRECT_URL`, plus repository variable `APIFY_ACTOR_ID`.
- **Railway deployment** is configured in Railway's GitHub integration, not through the Railway CLI. Enable Railway **Wait for CI** so deployment follows a successful `CI/CD` workflow.

Making `test` a required status check is a repository-settings change (Settings → Branches → protection rule for `dev`/`main`); it is not configured from this folder.

## Related docs

- `../../workflows/CONTEXT.md`
- `../../CLAUDE.md`
