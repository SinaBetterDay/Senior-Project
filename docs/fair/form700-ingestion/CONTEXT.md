# Workspace — Form 700 ingestion

## Role

**Form 700** files are **uploaded by admins** (raw **XLSX** archived in **Supabase Storage**). Parse with **SheetJS** (`xlsx` npm package) and map rows into your DB model per schedule.

## Schedules (domain vocabulary)

| Schedule | Content |
|----------|---------|
| **A** | Investments |
| **B** | Real estate |
| **C** | Income |
| **D** | Gifts |
| **E** | Travel payments |
| **A-2** | Business positions |

## Boundaries

- Parsing and validation rules belong with **server** code; storage policy with **Supabase Storage** (see `supabase/CONTEXT.md`).
- Do not expose bulk upload or admin endpoints without **Supabase Auth**.

## Related docs

- `server/CONTEXT.md`, `supabase/CONTEXT.md`
- Matching parsed entities: `../entity-resolution/CONTEXT.md`
