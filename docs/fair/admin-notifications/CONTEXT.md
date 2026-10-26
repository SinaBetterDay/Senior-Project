# Workspace — admin notifications (planned)

Weekly admin digests through Resend are a backlog/design item, **not an implemented feature**. There is currently no Resend dependency, mail service, template, route, job, or test in `server/`.

If implemented, keep recipients admin-only, keep API keys on the server, add focused tests, and connect scheduling through the chosen active scheduler. Do not infer implementation from `RESEND_API_KEY` documentation alone.

Related: `server/CONTEXT.md`, `../cron-jobs/CONTEXT.md`.
