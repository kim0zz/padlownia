# Domain contract v1 / adapters and normalizer v1.1

This package contains pure, offline TypeScript functions. It performs no network, filesystem, database or LLM calls. The worker owns file access, snapshot hashes, storage, staging and publication. Source data is always untrusted data.

## Validation boundary and current compatibility

The first implementation used synthetic fixtures. On 2026-10-14 the supplied full files were profiled programmatically and the adapters were updated to their genuine formats: **281 PadelTrue records** (model 1.0, built 2026-10-14) and **217 detailed padel.how records** (schema 2026-08-23). These are inspected snapshot counts, not permanent validation rules or a claim of publication. `rackets.json` and `padel how base.txt` are byte-identical copies of the latter. A separately supplied lightweight `data rackets.json` has the same 217 slugs and must not be imported as another catalogue. Original datasets remain local and ignored by Git.

Actual-format and synthetic contract inputs share the versioned ingestion contract. Unknown provider versions fail closed; identifying a PadelTrue export as padel.how or vice versa fails with `source_identity_mismatch`. Missing source units and ambiguous measurements still require review.

### Inspected PadelTrue model 1.0

The envelope carries `name`, `license`, `attribution`, `built`, `modelVersion`, `methodology`, `count`, and `rackets`. Records use `ratings` and nested `specs` whose values contain `display`, `verbatim`, a source URL string, `sourceType`, and structured interpretation fields (`value`, `min`/`max`, or `material`).

- Each specification keeps exact `verbatim` as `rawValue` with its original JSON pointer. Supplier interpretation values, their pointers and display text are separately retained in observation context; normalization never rewrites the original statement. These are supplier claims, not independently verified manufacturer evidence.
- Weight min/max units are grounded in the inspected [model methodology](https://padeltrue.com/methodology), which defines gram ranges. Thickness needs explicit `mm` in the source display. Numeric balance without a measurement reference stays unknown; any supplied qualitative balance remains separate from the stored numeric source values.
- Core material and the source's firmness label are different observations. Missing core material is not replaced with a firmness word. `roughSurface` produces a rough/not-rough observation without inventing spin performance.
- All six source ratings retain their original 0–100 scale and are labelled `rule_derived`, with model version and methodology retained. Missing rating inputs and supplier-declared `inputConflicts` trigger review. In this snapshot 10 value ratings are null for non-EUR prices; they stay unknown.
- `specs.price` remains dated metadata with currency and source evidence, outside physical specifications. Product links, original level descriptions, model-input coverage and profiles are also preserved. GBP/USD prices are not converted.

### Inspected padel.how schema 2026-08-23

The detailed export uses **flat** `shape`, `thickness_mm`, `weight_g`, `balance_cm`, `face_material`, `core`, `surface`, and `player_level` fields, ten `scores`, and one `score`. Envelope metadata includes the field dictionary, methodology, license/attribution notes, endpoint inventory, schema version and generated date.

- Numeric units and butt-reference context are accepted only from the exact inspected field definitions, with `/fields/...` provenance. Key suffixes or schema version alone never establish units. Changed definitions need review.
- `face_material` maps to the physical surface material; source `surface` maps to texture. The field dictionary describes shape as measured, so it remains measured evidence rather than a manufacturer declaration.
- Category scores are 0–10; the total is 0–100. The supplied `llms.txt` documents a rounded category sum. The adapter validates that relationship and keeps the original total. All 217 supplied rows satisfy it; 63 totals round a half-point sum upward.
- Dated affiliate retailers, prices/currencies, feel-map coordinates, gender/junior flags, court side, demand, play style and handle length remain metadata. Coordinates are not new product ratings. Missing material markers, demographic values in player level, area units in surface texture and complex measurement prose trigger review.
- All review, Markdown and per-item JSON URLs must identify the source's HTTPS origin. The connector records links and does not fetch them. Private document ingestion is a separate worker concern.

### Backward-compatible synthetic contracts

`parseSnapshot(source, bytesOrString)` accepts a UTF-8 JSON array or an object with `rackets: []`, optional numeric `count`/`total`, and optional `metadata`. Identity fields are `brand`, `name` (or `model`), numeric `year` (or `model_year`), optional `variant`, `id` (or `slug`), and `url` (or `product_url`). Years are not inferred from incomplete identity text. Records without an ID receive a snapshot-local index key and require review. Invalid brand/model/year records retain the complete raw payload in `recordErrors`. Duplicate IDs mark every affected row invalid.

- Synthetic PadelTrue uses `specs` (or `specifications`) and `scores`. A specification may be a raw value or `{ value, source: { type, name, url }, claim_type, unit, reference_point, context }`. A rating may be numeric or `{ value, scale: { min, max }, methodology }`; snapshot `metadata.rating_scale` and `metadata.methodology` supply explicit defaults. Without an explicit PadelTrue scale or the recognized published model contract, the score remains unverified. Scores are always labelled `rule_derived`.
- Synthetic padel.how uses `characteristics`, `ratings` and optional `overall_score`. The characteristics object is mandatory for this fixture shape. Category scores use 0–10 and the `overall` score uses 0–100. Original category names remain intact. Ratings are labelled `editorial`; they are not asserted to be lab tests.

URLs shown as source provenance must be HTTP(S) without embedded credentials. The JSON pointer `rawSourcePath` identifies the exact source value in the saved snapshot. Verbatim raw values are never replaced by normalized ones. Extra source fields remain in `rawPayload` even when they are not normalized.

The connector **does not trust a supplier's `verified` property** to certify manufacturer evidence: attribution starts with `verified: false`. Verification of exact variant/year and manufacturer provenance must be an explicit review action outside the connector. Manufacturer-labelled observations with unverified evidence have only secondary-source precedence.

## Normalization and exact matching

`normalizeRecord(record)` normalizes observations and identity, preserving source fields. `invalid` indicates identity/contract errors; `needs_review` includes missing IDs/years, unknown units and invalid observations/ratings. These states must block publication until reviewed by the worker/database gate.

- Explicit `g`/`kg` are required for mass; `mm`/`cm` are required for thickness. A numeric value needs explicit `context.unit`, which may come from inspected source-schema evidence as above. Field suffixes alone do not establish units.
- Numeric balance additionally requires a `from butt`/`from handle base` reference or explicit `context.referencePoint: "butt"`. Qualitative balance remains text. Unknown unit/reference/configuration never produces canonical numbers.
- Tolerances, ranges, approximate notation and supported overgrip context survive normalization. Unsupported measurement configurations require review rather than speculative parsing.
- A value of `women` is invalid as player level. Area values such as `530 cm²` cannot become surface material/texture.

`resolveIdentity(normalizeIdentity(identity), candidates)` auto-accepts only a unique exact normalized brand, complete model including all variant tokens, and known explicit year. Plus signs survive normalization, so Pro/Pro+ differ. Unknown-year inputs always require review. Prefix aliases with multiple plausible candidates require review. Distinct years and explicit variant disagreements are hard negatives; no fuzzy score or guessed threshold enables merging. Canonical IDs belong to the database, never to a supplier slug.

`selectProjection(observations)` selects only valid physical specification observations. Verified manufacturer evidence wins over secondary declarations; measured specimens and editorial opinions remain separate. Disagreement among equally preferred observations leaves the main value unknown. Alternative valid observations generate conflict flags and remain available in the immutable source records. Selection carries the full selected observation and its ID, pointer and source provenance.

## Reproducible coverage and limits

Run `npx vitest run tests/domain`. Fixtures are wholly synthetic CC0 examples in `tests/fixtures/`; no source catalogue or article archive is included. The labelled identity gold set contains 12 positives and 14 hard negatives, with tests enforcing nonempty denominators. This baseline checks these labels; it does not establish precision/recall on either real catalogue.

Supported priority scenarios: ING-001/002/005/006/007/008/009/010/011/012/013/014/021/025/027/028. Domain portions of ING-004 (per-record isolation/counts), ING-020 (detailed-feed requirement), ING-026 (untrusted input) and ING-031 (currency preservation) are covered. Storage, idempotence, release activation, rollback and access failures belong to worker/database integration tests.

Known intentionally conservative domain limitations: no remote fetching, no fuzzy auto-merges, no automatic manufacturer verification, no semantic inference for unsupported units/configurations, no automatic currency conversion, no ungrounded rating scales. Private document processing lives outside this package. Missing years (70 PadelTrue / 2 padel.how) remain unknown. The full source comparison produces 47 exact normalized cross-source identities and 47 review candidates among the 217 padel.how rows against 281 PadelTrue rows; these are deterministic candidate outcomes, not independently labelled precision/recall.
