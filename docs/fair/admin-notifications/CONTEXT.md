# Workspace — Admin notifications (Resend)

## Role

Send **weekly digests** (and other admin-only emails) via **Resend** — summaries of new flags, sync health, or review queues.

## Boundaries

- Recipients are **admins** only; no bulk mail to public users from this pathway unless product requirements change.
- API keys stay on **server**; templates live in `server/` or a dedicated templates folder as you adopt.

## Related docs

- `server/CONTEXT.md`
- `../cron-jobs/CONTEXT.md` (schedule digest sends)
