# Sonoma historical document pilot — November 4, 2026

## Scope and safety

This is a research comparison, not a conflict determination or an FPPC referral.
No application database rows, review states, identity flags, eligibility settings,
or public alerts were changed. Database comparisons used a read-only transaction.
The pilot made no LLM calls. Named examples below describe disclosure/document
overlaps only; they do not establish wrongdoing, participation, or recusal status.

The source workbook is `docs/County of Sonoma -- Form 700 (2019).xlsx`.
The comparison window was January 1–December 31, 2019, chosen to investigate the
workbook's filing-year label, **not** to certify its legal reporting period.
Annual filings were submitted in 2020 and some amendments later. Exact coverage
dates need source/client verification before operational detection.

## Form 700 audit

An independent direct-column projection of the original workbook reconciled with
the parser's 78 selected rows and all corresponding stored supported values:

| Schedule group | Selected rows |
|---|---:|
| A investments | 39 |
| A-2 business positions | 9 |
| B property | 13 |
| C/D/E income, gifts, travel | 17 |

There are 13 filer/year groups and 20 submission versions. Stored import digests
match the workbook. This establishes faithful handling of the supported columns
for the selected submissions, **not complete disclosure ingestion**.

Important limitations found:

- All 13 stored identities remain marked `needs_review`. This pilot did not clear
  those flags. It did not establish each official's authority over Board matters.
- James M Gore's latest selected submission excludes 15 older submission rows
  across A-2, B, and C/D/E. Lynda Hopkins's selected submission excludes two older
  A-2 rows. These are older-version row counts, not necessarily distinct interests.
  Do not blindly merge them: inspect the amendment semantics first.
- A-2 underlying income sources/entity-held assets, B lenders/rental sources,
  acquisition/disposal dates, and exact reporting periods are not fully ingested.
- Schedule C preserves source and range, but not the income consideration or
  position. Direct workbook review shows the selected Hopkins/LandPaths row is
  **spouse/domestic-partner income**, not necessarily the filer's employment.
  Cornwall's two Sonoma Ecology Center rows separately describe spouse/partner
  income and salary. Their identical stored source/range values are distinct
  source rows, not evidence of an import duplication bug.
- Direct source inspection found a gift date entered as `2/29/2019`, which is not
  a valid calendar date. This date is not currently ingested; source quality itself
  also needs validation before future date-sensitive rules.
- Stored Sonoma agendas cover 2025 (124 items) and 2026 (543 items), not 2019.
  The local filing-period-offset setting is absent. No existing automatic output
  should be interpreted as evidence of a completed 2019 comparison.

## Legistar collection and comparison

The live pilot found 61 meetings in 2019. Thirteen returned no event items and 48
had items. Empty upstream records are coverage gaps, not no-conflict findings.

Of 1,133 unique matters, a deterministic evenly spaced sample selected 200.
All 200 event-version-matched matter texts were retrieved. The sample exposed
439 attachment records and 427 unique PDF candidates; 40 prioritized PDFs were
parsed. The remaining 933 matters and 387 PDF candidates were outside the bounds.
The bounded run recorded no retrieval/parse errors.

| Same sampled matter-linked items | Disclosure/item pairs |
|---|---:|
| Agenda-only mentions | 1 |
| Enriched-text mentions | 13 |
| Additional beyond agenda-only | 12 |
| Union | 13 |

These counts are **not distinct leads or verified conflicts**. They retain
separate disclosure rows, including Cornwall's two same-source income rows.
Additional agenda mentions outside the enriched sample are excluded from this
comparison. The initial 40-PDF sample added no name occurrences; the incremental
matches came from expanded matter text.

## Evidence reviewed and false-positive lessons

### Agreement amendments: useful transaction evidence

June 11, 2019, matter 4390, event item 20943, text ID 4434:
the agenda title is only **Agreement Amendments and Extensions**. The expanded
recommended actions identify LandPaths and Sonoma Ecology Center.

The linked **Summary Report**, attachment 3719, was additionally fetched outside
the 40-PDF sample to independently check the strongest transaction example.
Page 1 agrees with the API text:

- LandPaths: proposed $218,138 amendment increase, $1,451,842 revised total.
- Sonoma Ecology Center: proposed $62,235 increase, $322,427 revised total.

The selected workbook has Hopkins/LandPaths and Cornwall/Sonoma Ecology Center
income sources in the $10,001–$100,000 range. That overlap warrants contextual
review, not an automatic conclusion. Cornwall is listed as a Planning Commissioner;
this Board item does not establish her decision-making involvement. For Hopkins,
the source row describes spouse/partner income. Votes, recusals, participation,
identity, and reporting-period applicability have not been validated.

Official source references:

- [Matter text](https://webapi.legistar.com/v1/sonoma-county/Matters/4390/Texts/4434)
- [Summary Report PDF](https://sonoma-county.legistar1.com/sonoma-county/attachments/6e910901-701c-4e6a-b5c4-4f4566e41a85.pdf)

### Examples that should not be promoted blindly

- An **Apple** investment matched **Apple Blossom Art Show**, matter 5403,
  December 17, 2019. This is a wrong-entity lexical hit, not Apple Inc. business.
- The September 10 employee Day of Caring recognition report, matter 4939,
  names LandPaths and Sonoma Ecology Center as volunteer/community context.
  Name occurrence alone does not establish a relevant financial decision.
- Public-agency/transportation mentions, grant partners, historical contracts,
  and recommended contractors require distinct role/context review.

## Recommendation

Use event items as the index and **version-matched expanded matter text as the
first enrichment layer**, then staff-report/contract PDFs as corroborating
evidence or fallback. Keep minutes/votes separate for action and participation.
The official API exposes text version/ID fields and attachment metadata; a current
attachment's version 0/modified date does not prove historical availability.

Before operational alerts: resolve filer identities, amendment completeness,
income relationship context, reporting periods, official authority/participation,
and common-name/transaction-role handling. Do not lower matching thresholds to
increase the number of findings. This pilot measures document utility, not
precision or recall against an independently adjudicated dataset.

## Reproduction and private artifacts

See the Sonoma pilot command in the root README. The CLI writes private JSON,
refuses to overwrite files, and does not import results into the application.
Full raw evidence is deliberately kept outside version control:

- `/tmp/fair-sonoma-audit-20261104.json`: workbook/database reconciliation.
- `/tmp/fair-sonoma-pilot-2019-20261104.json`: first comparison run.
- `/tmp/fair-sonoma-pilot-evidence-20261104.json`: repeat with full retrieved
  matter text, PDF page text, and hashes for local evidence review.
- `/tmp/fair-sonoma-landpaths-pdf.json`: targeted Summary Report page extraction.

Temporary files are not durable archives. Copy them to approved private storage
if retention is needed; do not commit them or publish research mentions as alerts.