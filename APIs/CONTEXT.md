# APIs / agenda tooling — FAIR (`APIs/`)

## Role

Supporting scripts and integrations for **agenda data** — e.g. **Legistar REST** (JSON) and paths toward **Apify** / PDF sources for cities without Legistar.

## Boundaries

- Prefer **Legistar** when the city exposes a usable API.
- **Apify** + **PDF** paths are for cities that only publish agendas as documents — see `docs/fair/agenda-ingestion/CONTEXT.md`.
- Language here may differ from the main **Node** app (`import requests.py` under `Agendas/`); keep behavior documented when moving logic into `server/`.

## Related docs

- Agenda pipeline: `docs/fair/agenda-ingestion/CONTEXT.md`
- Cron orchestration: `docs/fair/cron-jobs/CONTEXT.md`
