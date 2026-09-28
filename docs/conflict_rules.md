# Conflict of Interest Rules

FAIR surfaces **potential** conflicts for review; it does not determine whether an
official has a legal conflict or must recuse. The executable thresholds and rule
references are maintained in `server/src/config/conflictRules.js`; this document
describes the corresponding review rules.

| Schedule | Interest | Trigger used by FAIR | Threshold / severity input | Reference |
|---|---|---|---|---|
| A | Investment | The agenda text names a disclosed business entity or investment. | Investments below $2,000 are not automatically flagged; the disclosed fair-market-value range determines severity. | Cal. Gov. Code §§87100, 87103(a) |
| A-2 | Business position | The agenda text names a business entity in which the filer holds a disclosed position. | The position is flagged regardless of a parsed dollar amount; severity is MEDIUM pending reviewer assessment. | Cal. Gov. Code §§87100, 87103(d) |
| B | Real estate | An agenda item directly names the disclosed property, or a land-use item matches the disclosed city/county. | The disclosed fair-market-value range determines severity. | Cal. Gov. Code §§87100, 87103(b) |
| C | Income | The agenda text names a disclosed income source. | $500 or more when an amount can be parsed; the amount determines severity. | Cal. Gov. Code §§87100, 87103(c) |
| D | Gifts | The agenda text names a disclosed gift source. | $50 or more when an amount can be parsed; the amount determines severity. | Cal. Gov. Code §§87100, 87103(e) |
| E | Travel payments | The agenda text names a disclosed travel-payment source. | $50 or more when an amount can be parsed; the amount determines severity. | Cal. Gov. Code §§87100, 87103(c) |

Entity names are normalized before matching. High-confidence fuzzy matches are
accepted automatically; only scores from 0.70 through 0.85 may be sent to Gemini
for a constrained yes/no resolution. Every stored conflict retains its entity,
rule reference, severity, and source key for auditability.

## Approval status

The checked-in Jira export requires client approval of these rules. This repository
contains no written client approval artifact as of September 28, 2026, so that
external sign-off remains outstanding before FAIR should be represented as an
authoritative legal determination.
