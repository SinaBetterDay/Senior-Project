# GitHub Actions — FAIR (`.github/workflows/`)

## Role

CI/CD for the monorepo, defined in `ci.yml`.

- **`test` job** — runs on every PR to `dev` / `main` and on push to `main`. Spins up a `postgres:15` service, then in `server/`: `npm ci` → `npx prisma generate` → `npx prisma migrate deploy` → `npm test` (vitest, `tests/unit`). `DATABASE_URL` and `DIRECT_URL` both point at the service container.
- **`deploy` job** — Railway (`railway up`), needs `test`, runs **only** on push to `main`. Requires the `RAILWAY_TOKEN` repository secret.

Making `test` a required status check is a repository-settings change (Settings → Branches → protection rule for `dev`/`main`); it is not configured from this folder.

## Related docs

- `../../workflows/CONTEXT.md`
- `../../CLAUDE.md`
