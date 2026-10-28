# False-positive review log

## Status

This log is the audit record for SH-52. The code changes in this sprint are
implemented and covered by unit tests, but the real-data review and written
client approval are still required before this log can be marked complete.
Do not record simulated or test fixtures as client-reviewed conflicts.

## Review protocol

1. Export at least 30 currently flagged conflicts from the shared environment.
2. Review each item with the client and mark it as `confirmed`,
   `false_positive`, or `needs_follow_up`.
3. For every false positive, record the conflict ID, the disclosed entity, the
   agenda reference, root cause, and the corrective action below.
4. Re-run detection after a rule change and calculate the before/after rate:

   `false-positive rate = false positives / reviewed conflicts * 100`

5. Add the client approver's name, approval date, and written approval link or
   quoted decision in the sign-off section.

## Tuning decision

| Rule | Before | After | Reason |
| --- | --- | --- | --- |
| Automatic entity-match confidence | 0.85 | 0.90 | Scores below 0.90 now require the existing Gemini review instead of automatically creating a conflict. |
| Entity exclusion list | None | `City of Los Angeles` | A public agency can appear as a generic disclosure entity but should not independently trigger a named-entity conflict. |

The changes are intentionally centralized in
`server/src/config/conflictRules.js`, so the nightly sync, historical backfill,
and new-city ingestion all use the same rules without changing conflict API,
CSV, PDF, or UI response shapes.

## Real-data review results

| Review date | Conflict ID | Disclosed entity | Agenda item | Finding | Root cause | Corrective action |
| --- | --- | --- | --- | --- | --- | --- |
| Pending client review | — | — | — | — | — | — |

## Before/after false-positive rate

| Run | Reviewed conflicts | False positives | False-positive rate | Evidence |
| --- | ---: | ---: | ---: | --- |
| Before SH-52 rules | Pending | Pending | Pending | Add exported review worksheet or query result. |
| After SH-52 rules | Pending | Pending | Pending | Add exported review worksheet or query result. |

## Client sign-off

Pending. Record written approval here after the client has reviewed at least 30
real conflicts and agrees that the tuned results are acceptable.
