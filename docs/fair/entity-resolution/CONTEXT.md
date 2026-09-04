# Workspace — Entity resolution & matching

## Role

Link **people / entities** across Form 700 rows and agenda lines, then flag potential **conflicts of interest**.

## Matching stack

- **Fuzzy matching:** `fuse.js` for name and text similarity.
- **LLM:** **Google Gemini 1.5 Flash API** — use **only** when fuzzy scores fall **between 0.7 and 0.85** (ambiguous band). Outside that band, rely on rules + fuse thresholds without extra LLM cost.

## Boundaries

- No Gemini calls for every row by default; keep resolution **deterministic** when possible.
- Log or persist resolution decisions for auditability (FPPC context).

## Related docs

- `../form700-ingestion/CONTEXT.md`, `../agenda-ingestion/CONTEXT.md`
- `server/CONTEXT.md`
