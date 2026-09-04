# Supabase workspace — FAIR (`supabase/`)

## Role

**PostgreSQL** (hosted on Supabase), **Auth** (admin-only), **Storage** (Form 700 XLSX archives), and **SQL migrations** / RLS policies.

## Expectations

- **Auth:** single admin email/password; **no** public registration flows in app or policies.
- **Storage:** bucket(s) for raw **Form 700** files; align naming with backend upload routes.
- **Migrations:** versioned under `migrations/`; document breaking changes in commit messages.

## Related docs

- Backend integration: `server/CONTEXT.md`
- Form uploads: `docs/fair/form700-ingestion/CONTEXT.md`
