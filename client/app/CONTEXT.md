# React routes and UI (`client/app/`)

Start at `routes.ts`; it is the authoritative route manifest. Public routes cover home, conflicts, politicians, agendas, and about. Admin routes cover login, upload, politicians, sources, and reports.

## Placement

- Route/page behavior: `routes/*.tsx`.
- Reusable visual pieces: `components/`.
- Reusable state/data logic: `hooks/`.
- Transport and external-service helpers: `lib/`.
- Global layout/styles: `root.tsx` and `app.css`.

Use functional TypeScript components and hooks. Keep tests next to the source when practical. Verify keyboard-visible behavior, loading/error states, and public/admin boundaries rather than implementation details.

`routes/politician.profile.tsx` exists but is not registered in `routes.ts`; do not treat it as a live page without confirming intent.

Parent guide: `../CONTEXT.md`.
