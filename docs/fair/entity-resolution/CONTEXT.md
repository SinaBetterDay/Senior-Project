# Workspace — entity resolution and conflict detection

Two matching flows use different thresholds; do not merge them accidentally.

## Agenda text ↔ disclosed entity

- Entry point: `server/src/detection/matchEntity.js`.
- Threshold source: `server/src/config/conflictRules.js`.
- Exact/normalized or fuzzy score `>= 0.90`: automatic match.
- Score `0.70–0.899…`: optional Gemini decision.
- Score `< 0.70`: no match.
- Tests: `server/tests/unit/matchEntity.test.js` and detector-specific tests.

## Uploaded filer ↔ politician

- Entry point: `server/src/utils/findOrCreatePolitician.js`.
- Score `>= 0.85`: reuse politician.
- Score `0.70–0.849…`: optional Gemini decision.
- Otherwise create a politician marked for review.
- Tests: `server/tests/unit/findOrCreatePolitician.test.js`.

## Detection and persistence

`server/src/detection/detectConflicts.js` orchestrates investment, real-estate, income/gift/travel, and business-position detectors, then `persistConflicts.js` stores deduplicated results. Executable legal thresholds and exclusions live in `server/src/config/conflictRules.js`; explanatory rules live in `docs/conflict_rules.md`.

Keep deterministic normalization and exclusion rules ahead of LLM calls. FAIR produces review candidates, not legal conclusions.
