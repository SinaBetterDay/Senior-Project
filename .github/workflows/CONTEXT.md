# GitHub Actions (`.github/workflows/`)

## Active workflow

`ci.yml` runs on pull requests to `dev`/`main` and pushes to `main`. It provisions PostgreSQL 15, installs backend and frontend dependencies, generates Prisma, deploys migrations, runs documentation validation, and runs backend unit tests.

The frontend dependencies are installed, but frontend tests/typecheck/build are not currently CI steps. The Apify package is also not installed or tested by CI.

## Disabled placeholders

`scheduled-legistar-sync.yml` and `scheduled-apify-agendas.yml` each contain only `# disabled`. Treat any schedules described elsewhere as target deployment guidance until these files contain valid workflows.

Railway deployment and required branch checks are repository/platform settings, not configured here.

Related: `../../CLAUDE.md`, `../../DIRECTORY.md`.
