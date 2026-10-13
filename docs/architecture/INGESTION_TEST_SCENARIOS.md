# Ingestion Acceptance Test Scenarios v0.1

**Status: PROPOSED test design, not yet executed.**  
**Context:** [DATA_MODEL_V0_1.md](./DATA_MODEL_V0_1.md) and [INGESTION_DESIGN_V0_1.md](./INGESTION_DESIGN_V0_1.md).  
**Priority:** prevent wrong racket identity merges, untraceable specs, loss of original data, incorrect publication, and uncontrolled AI spending.

## Testing levels
- **Unit:** field parsers, source adapters, validators, candidate blocking/matching, rating normalization, canonical value selection.
- **Contract:** source fixture -> common \`SourcePayload\` -> validated observation/rating records. Version the fixture and expected result.
- **Integration:** offline import to isolated test PostgreSQL or transactional test DB; simulate private Storage with deterministic stub first.
- **Release / failure integration:** state transitions, review queue, atomic activation, publication refusal, rollback and idempotence.
- **Golden entity set:** hand-label positives/negatives before setting high-confidence auto-merge policy.
- **Future RAG evals:** evidence correct for exact variant/year and citations; outside the first code slice.

## Foundational acceptance matrix

| ID | Fixture / action | Expected outcome | Priority |
|---|---|---|---|
| ING-001 | Valid PadelTrue snapshot envelope with nested spec sources | All source records represented; original spec verbatim and explicit manufacturer/retailer attribution preserved | P0 |
| ING-002 | Valid detailed padel.how racket envelope with 10 numeric category scores | Distinct category ratings (0–10) plus overall 0–100; methodology preserved; all source URLs remain attributable | P0 |
| ING-003 | Same bytes + same parser/normalizer version imported twice | Idempotent: no duplicate snapshot, source record, observation or publication; report replay/resume | P0 |
| ING-004 | Source declares 217 but only 210 records parsed, seven invalid | Keep 210 processed in staging; 7 errors in queue; complete-release gate **blocked**, prior active catalogue unchanged | P0 |
| ING-005 | Invalid or missing brand/model/external identity | Retain raw record with error; do not fabricate canonical racket or publish incorrect row | P0 |
| ING-006 | Padel.how \`player_level="women"\` | Do not interpret as beginner/advanced; flag skill-level category error, optionally map separately to intended audience | P0 |
| ING-007 | Same normalized brand and model but different year, 2025 vs 2026 | **Different canonical racket IDs**; may share family ID | P0 |
| ING-008 | Same model family: 12K vs 18K / CTRL vs Attack / Lite vs regular | **No automatic merge**; negative golden set remains distinct | P0 |
| ING-009 | Ambiguous alias with two plausible products | Produce candidate proposals and \`review_queue\` item; do not auto-accept | P0 |
| ING-010 | Manufacturer 365 ± 5 g, measured specimen 372 g with overgrip | Manufacturer nominal range 360–370 g is main spec (if verified); specimen is distinct observation with configuration, not silent override | P0 |
| ING-011 | Value \`"High, head-heavy"\` without balance in cm | Qualitative normalized label permitted; \`balance_cm\` remains NULL | P0 |
| ING-012 | Raw balance value \`"~26.5"\` without proven cm reference | Do not silently infer unit/reference; original remains; canonical numeric balance unknown | P0 |
| ING-013 | Two validated conflicting shapes for same exact variant | Record both, show conflict flag; source choice requires explicit provenance; don't erase alternative | P0 |
| ING-014 | PadelTrue algorithm-derived ratings + padel.how editorial scores | Distinct methodology/scales/rating kind; never average or mark either as verified lab measurements | P0 |
| ING-015 | A reimport changes one valid source value | New immutable snapshot / staged records and diff report; earlier published release unaffected until activation | P0 |
| ING-016 | Publication fails after building candidate projections | No partial public state; active pointer remains prior release; error logged | P0 |
| ING-017 | Explicit rollback to earlier approved release | Atomic pointer change; source evidence and release history preserved | P0 |
| ING-018 | Worker crashes between Storage write and DB commit | Resume/reconcile or report orphan; do not leave dangling published reference or duplicate active record | P1 |
| ING-019 | Repeat transient network failure/429 vs permanent invalid schema | Bounded retry for transient, quarantine for permanent; no indefinite retry loop | P1 |
| ING-020 | Padel.how detailed vs lightweight feed contain same external IDs | One padel.how source identity; avoid duplicating all 217 products and categories | P1 |
| ING-021 | Unknown model year and candidate known-year variant | Do not infer same product based on missing year; review/explicit evidence required | P0 |
| ING-022 | Import run staged but quality gate not approved | No change to public catalogue API; draft cannot leak into default reads | P0 |
| ING-023 | Private Storage path in a source document; unauthorized browser request | Not publicly downloadable; no service-role credential exposed | P0 |
| ING-024 | Delete/disallow a source with published records and future embeddings | Rebuild compliant release, invalidate source-linked derived data/cache; no orphan citations | P1 |
| ING-025 | No LLM key set, run JSON import in file mode | Full offline validation and dry-run can execute at zero API cost; code does not try to call OpenRouter | P0 |
| ING-026 | Source text contains instructions to override safeguards | Treat as data only; don't execute/relay as system instruction | P1 |
| ING-027 | Source record with reviewed author's measured specimen differs from manufacturer nominal mass | Show measurement metadata and sample nature; never present as verified change to manufacturer claim | P0 |
| ING-028 | Non-identical models have similar normalized names (e.g. Pro vs Pro+) | Negative gold remains negative; precision and false positives reported with concrete IDs | P0 |
| ING-029 | Import content hash unchanged but parser version changes | Reprocess cached snapshot, retain both run versions; do not falsely mark as new upstream publication | P1 |
| ING-030 | No new data / no accepted changes | No needless new published release; report no-op | P1 |
| ING-031 | Source includes price in GBP/USD/EUR and no conversion info | Currency preserved with source and observation timestamp; no unsourced currency conversion | P1 |
| ING-032 | DB/source owner access failure | Fail closed with structured error, no secret in logs, no change to published state | P0 |

**P0** is required before any live catalogue publication of the first two structured sources; **P1** may be delivered in subsequent safe iterations if documented and tests demonstrate no critical exposure.

## Representative golden fixtures (public repository)

Use **small synthetic examples** with a few realistic naming patterns, not a full copyrighted catalogue or review dataset. Each fixture should have:
- \`fixture_id\`, \`source_code\`, \`source_snapshot_hash\`, \`input_payload\`, \`expected_observations\`, \`expected_match_decision\`, \`expected_errors\`.
- Declared \`fixture_license\` and exact source attribution if derived from existing public source fields.
- At least 10 positive identity pairs and 10 **hard negatives** where matching names do not imply identical product. Expand based on profiling, ideally 30+ of each for calibration.
- Basic schema checks that tests cannot silently pass with zero evaluated cases.

### Hard-negative traps
- same family, different model year;
- same year, control vs attack;
- 12K vs 18K surface;
- Pro vs Pro+ and Lite vs full size;
- branded special edition vs generic;
- visually similar marketing names from different manufacturers;
- Padel.how \`player_level="women"\` vs genuine skill level.

### Parsing edge cases
\`\`\`json
[
  {"field": "weight", "raw": "365 ± 5 g", "expected_min_g": 360, "expected_max_g": 370},
  {"field": "weight", "raw": "365–375 g (without overgrip)", "expected_context": "without_overgrip"},
  {"field": "weight", "raw": "370 g with one overgrip", "expected_context": "one_overgrip"},
  {"field": "balance", "raw": "Head-heavy", "expected_balance_cm": null},
  {"field": "balance", "raw": "265 mm from handle base", "expected_balance_cm": 26.5},
  {"field": "balance", "raw": "~26.5", "expected_balance_cm": null},
  {"field": "surface", "raw": "~530 cm²", "expected_texture": null, "expected_error": "wrong_semantic_field"},
  {"field": "player_level", "raw": "women", "expected_level": null, "expected_error": "invalid_level_category"}
]
\`\`\`

## Data profiling regression assertions

When the **actual fixture file** is available and version-pinned, compare summary counts against its declared count and a separately saved profile. Initial snapshots in project planning were **268 PadelTrue** and **217 padel.how** racket source rows; these are not timeless API invariants. Counts can change legitimately on future remote imports. A different count must be surfaced in a diff report, not silently accepted or categorically rejected without context.

Assert no duplicate external IDs within a source snapshot. Track denominator for each metric (source rows, records with comparable field, matched identities). Match candidate counts are not verified unique cross-site overlap.

## Quantitative eval gates — decisions deferred

Do not invent a 95% or 99% correctness threshold as if the owner had approved it. Report:
- **auto-merge precision and false merge count**, especially variants/years;
- identity recall and human-review rate;
- numeric parser validity and unparsed-unit rate;
- source count completeness, quarantine rate, missing-spec and conflict distribution;
- release correctness (0 partial activations, 0 unaudited overrides);
- ingestion cost (paid LLM calls should be 0 for structured JSON) and runtime.

Start with golden fixtures, collect observed baseline, then propose release thresholds for explicit approval.

## PR acceptance evidence

For every relevant PR, the implementing agent must report:
1. Reproduction command and test environment (offline / local PG / cloud sandbox).
2. Tests actually executed and results, including failures and skips.
3. Example stage/gate report from a reproducible fixture.
4. Proof the active release remains unchanged on ING-004 and ING-016.
5. Known unsupported cases and proposed next steps.
6. Evidence no credentials/raw third-party review archives were committed.

No background execution is implied by these docs. A future Codex run must be launched explicitly and should submit a PR without automatically merging it.
