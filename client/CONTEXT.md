# Frontend workspace — FAIR (`client/`)

## Role

Public **Financial Accountability & Interest Review** UI: explore cross-references between **Form 700** disclosures and **city council agendas**. **No login** for normal visitors.

## Stack

- **React** (Vite), **Tailwind CSS**, **React Router** (v7 app in `app/`).
- Deploy target: **Vercel** (pair with Railway for `server/`).

## Boundaries

- **Admin-only** flows (upload Form 700, sync controls, digest settings) must go **behind** Supabase Auth; do not expose registration.
- Call backend **Express** API in `server/` for privileged operations; keep keys server-side.

## Related docs

- API & env: `server/CONTEXT.md`
- Supabase buckets/auth rules: `supabase/CONTEXT.md`
