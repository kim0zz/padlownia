# Domain and connector contract v1

This package contains pure, offline TypeScript functions. It performs no network, filesystem, database or LLM calls. The worker owns file access, snapshot hashes, storage, staging and publication. Source data is always untrusted data.

## Validation boundary and current compatibility

No actual PadelTrue or detailed padel.how snapshots were available during implementation. The supported shapes below are **synthetic contract fixtures based on the engineering brief**, not a verified profile of either live source. Before a real import, profile the complete authorized file and adapt/version the connector as necessary. Unexpected envelopes fail closed. Do not claim the historical 268/217 counts were imported or use those counts as permanent validation rules.

`parseSnapshot(source, bytesOrString)` accepts a UTF-8 JSON array or an object with `rackets: []`, optional numeric `count`/`total`, and optional `metadata`. Identity fields are `brand`, `name` (or `model`), numeric `year` (or `model_year`), optional `variant`, `id` (or `slug`), and `url` (or `product_url`). Years are not inferred from incomplete identity text. Records without an ID receive a snapshot-local index key and require review. Invalid brand/model/year records retain the complete raw payload in `recordErrors`. Duplicate IDs mark every affected row invalid.

- PadelTrue uses `specs` (or `specifications`) and `scores`. A specification may be a raw value or `{ value, source: { type, name, url }, claim_type, unit, reference_point, context }`. A rating may be numeric or `{ value, scale: { min, max }, methodology }`; snapshot `metadata.rating_scale` and `metadata.methodology` supply explicit defaults. Without an explicit PadelTrue scale, the score remains unverified. Scores are always labelled `rule_derived`.
- Detailed padel.how uses `characteristics`, `ratings` and optional `overall_score`. The characteristics object is mandatory so a lightweight feed cannot quietly pass as detailed. Category scores use 0–10 and the `overall` score uses 0–100. Original category names remain intact. `markdown_url`, `json_url`, `image`, `offers`, `price`, `currency`, `updated_at`, `metadata` and `conflicts` are preserved as metadata; originals also remain in `rawPayload`. Image links are not downloaded. Ratings are labelled `editorial`; they are not asserted to be lab tests.

URLs shown as source provenance must be HTTP(S) without embedded credentials. The JSON pointer `rawSourcePath` identifies the exact source value in the saved snapshot. Verbatim raw values are never replaced by normalized ones. Extra source fields remain in `rawPayload` even when they are not normalized.

The connector **does not trust a supplier's `verified` property** to certify manufacturer evidence: attribution starts with `verified: false`. Verification of exact variant/year and manufacturer provenance must be an explicit review action outside the connector. Manufacturer-labelled observations with unverified evidence have only secondary-source precedence.

## Normalization and exact matching

`normalizeRecord(record)` normalizes observations and identity, preserving source fields. `invalid` indicates identity/contract errors; `needs_review` includes missing IDs/years, unknown units and invalid observations/ratings. These states must block publication until reviewed by the worker/database gate.

- Explicit `g`/`kg` are required for mass; `mm`/`cm` are required for thickness. A numeric value needs explicit `context.unit`. Field suffixes alone do not establish units.
- Numeric balance additionally requires a `from butt`/`from handle base` reference or explicit `context.referencePoint: "butt"`. Qualitative balance remains text. Unknown unit/reference/configuration never produces canonical numbers.
- Tolerances, ranges, approximate notation and supported overgrip context survive normalization. Unsupported measurement configurations require review rather than speculative parsing.
- A value of `women` is invalid as player level. Area values such as `530 cm²` cannot become surface material/texture.

`resolveIdentity(normalizeIdentity(identity), candidates)` auto-accepts only a unique exact normalized brand, complete model including all variant tokens, and known explicit year. Plus signs survive normalization, so Pro/Pro+ differ. Unknown-year inputs always require review. Prefix aliases with multiple plausible candidates require review. Distinct years and explicit variant disagreements are hard negatives; no fuzzy score or guessed threshold enables merging. Canonical IDs belong to the database, never to a supplier slug.

`selectProjection(observations)` selects only valid physical specification observations. Verified manufacturer evidence wins over secondary declarations; measured specimens and editorial opinions remain separate. Disagreement among equally preferred observations leaves the main value unknown. Alternative valid observations generate conflict flags and remain available in the immutable source records. Selection carries the full selected observation and its ID, pointer and source provenance.

## Reproducible coverage and limits

Run `npx vitest run tests/domain`. Fixtures are wholly synthetic CC0 examples in `tests/fixtures/`; no source catalogue or article archive is included. The labelled identity gold set contains 12 positives and 14 hard negatives, with tests enforcing nonempty denominators. This baseline checks these labels; it does not establish precision/recall on either real catalogue.

Supported priority scenarios: ING-001/002/005/006/007/008/009/010/011/012/013/014/021/025/027/028. Domain portions of ING-004 (per-record isolation/counts), ING-020 (detailed-feed requirement), ING-026 (untrusted input) and ING-031 (currency preservation) are covered. Storage, idempotence, release activation, rollback and access failures belong to worker/database integration tests.

Known intentionally conservative limitations: no article parsing, no remote fetching, no fuzzy auto-merges, no automatic manufacturer verification, no semantic inference for unsupported units/configurations, no automatic currency conversion, no inferred PadelTrue rating scale. The source snapshots supplied later may require small source-adapter changes, but the shared contract and review gates should remain stable.
