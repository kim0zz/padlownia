# Canonical Data Model v0.1

**Status: PROPOSED technical design (not an approved ADR, not an implemented migration)**  
**Date:** 2026-10-13  
**Source of truth:** [DECISIONS.md](../product/DECISIONS.md), especially P-023 to P-030.  
**Scope:** structured racket ingestion first; review evidence/retrieval tables are forward-compatible sketches.

## Invariants (accepted)
1. Each **exact product variant + year** has a distinct canonical identity; related identities belong to a model family (P-024). Do not merge missing-year candidates into a known-year product without evidence.
2. Manufacturer-declared physical specification is the **preferred main catalogue value** when verified, while competing values remain visible and traceable (P-023). A claim relayed by an aggregator is not automatically verified as manufacturer-authored.
3. Preserve verbatim original, normalized interpretation, unit, range, measurement configuration, provenance and validation status (P-026/P-027). Unknown is not zero.
4. Raw source versions are immutable; snapshots/releases are versioned and rollbackable (P-025/P-028/P-030).
5. Source ratings, measurements and editorial opinions **are separate from specifications**; never merge incompatible scales or portray algorithmic ratings as physical tests.
6. Public-facing reads only use an **approved published release**, not a working import.

## Logical relationships

\`\`\`text
data_sources 1──N source_snapshots 1──N source_records
                  │                      ├──N spec_observations
                  │                      ├──N source_ratings
                  │                      └──N source_entity_matches N──1 rackets N──1 racket_families
                  └──N ingestion_runs
review_documents 1──N review_document_versions 1──N review_chunks
                                              ├──N review_evidence N──1 rackets
                                              └──N review_racket_mentions N──1 rackets
catalog_releases 1──N release_sources N──1 source_snapshots
                 1──N racket_projections N──1 rackets
catalog_state(singleton) ──active_release_id──> catalog_releases
review_queue ──> disputed entity/observation/match/import
\`\`\`

All proposed names below are **implementation options**. Codex may improve SQL types/indexing but must keep the above semantics; material changes require an ADR.

## Tables — first slice (candidate fields and constraints)

### data_sources
- \`id uuid PK\`, \`code text UNIQUE NOT NULL\` (e.g. \`padeltrue\`, \`padelhow\`), \`display_name\`, \`base_url\`, \`source_type\` (catalogue, review_site, manufacturer), \`rights_status\`, \`attribution_rules jsonb\`, \`enabled boolean\`.
- Store written permission *reference/notes* separately; do not commit private correspondence into the public repo.

### source_snapshots
- \`id uuid PK\`, \`source_id FK\`, \`retrieved_at timestamptz\`, \`source_version text NULL\`, \`schema_version text NULL\`, \`sha256 char(64)\`, \`storage_bucket text\`, \`storage_path text\`, \`declared_count int NULL\`, \`actual_count int NULL\`, \`status text\`, \`metadata jsonb\`.
- Unique \`(source_id, sha256)\` or reuse same snapshot for identical bytes, with separate retrieval attempt history; avoid inserting identical immutable content N times.
- Storage paths are private, content-addressed or version-scoped; never derive public URLs for raw archives.

### ingestion_runs
- \`id uuid PK\`, \`source_id FK\`, \`snapshot_id FK NULL\`, \`initiator\`, \`started_at\`, \`completed_at\`, \`status\`, \`worker_version\`, \`parser_version\`, \`normalizer_version\`, \`metrics jsonb\`, \`error_summary\`, \`idempotency_key UNIQUE\`.
- A run logs progress and outcome; it is **not** the published data version.

### source_records
- \`id uuid PK\`, \`snapshot_id FK\`, \`source_id FK\`, \`external_id text\`, \`source_url text NULL\`, \`raw_payload jsonb NOT NULL\`, \`payload_sha256 char(64)\`, \`record_status\`, \`validation_errors jsonb\`.
- Unique \`(snapshot_id, external_id)\`; do not use name alone as external ID. For records lacking an ID, generate a *snapshot-local stable key* plus flag.
- Retain raw payload even when parsing/normalization fails.

### racket_families and rackets
- \`racket_families(id PK, brand_key, family_key, display_name, ...)\` with unique normalized brand + family key.
- \`rackets(id uuid PK, family_id FK NULL, brand_key, normalized_model_key, variant_key, model_year int NULL, display_name, identity_status)\`.
- Product identity includes meaningful variant tokens (e.g. CTRL, Attack, Lite, Pro+, 12K, 18K). \`model_year IS NULL\` represents **unknown** year, not “any year”. A uniqueness constraint should handle null correctly (e.g. normalized generated identity key or explicit NULLS NOT DISTINCT on supported PostgreSQL).
- Do **not** use a PadelTrue or Padel.how slug as our canonical UUID; maintain per-source aliases in \`source_records\` / mappings.

### source_entity_matches
- \`id uuid PK\`, \`source_record_id FK\`, \`racket_id FK NULL\`, \`candidate_score numeric NULL\`, \`decision\` (proposed, auto_accepted, manually_accepted, rejected, needs_review), \`rule_version\`, \`reason_codes jsonb\`, \`reviewed_by NULL\`, \`reviewed_at NULL\`, \`created_at\`.
- Allow multiple *proposals*, but enforce at most one accepted mapping **per source record within a selected release**. Keep decision audit and rejected candidates.

### spec_observations
- \`id uuid PK\`, \`source_record_id FK\`, \`attribute_key text\`, \`raw_value jsonb\`, \`normalized_text text NULL\`, \`value_min numeric NULL\`, \`value_max numeric NULL\`, \`numeric_value numeric NULL\`, \`unit text NULL\`, \`measurement_context jsonb\`, \`claim_type\` (manufacturer_declared, retailer_claim, measured_specimen, editorial_assessment, unknown), \`validation_status\`, \`parser_version\`, \`evidence_locator jsonb\`.
- One observation can be a range, scalar or descriptive value; do not force e.g. “head-heavy” into arbitrary centimetres.
- \`measurement_context\` can hold gripped/ungripped, overgrip count, adjustable weight settings, approximate estimate, tolerance, manufacturer model claim vs measured individual unit.
- Typed standardized units: **grams** for mass, **centimetres from the butt** for balance, **millimetres** for thickness. Convert only when original reference point is sufficiently specified.
- A verified original source must remain accessible by \`source_record_id\` and source metadata.

### source_ratings
- \`id uuid PK\`, \`source_record_id FK\`, \`dimension_key\`, \`raw_value jsonb\`, \`numeric_score numeric NULL\`, \`scale_min\`, \`scale_max\`, \`methodology_key\`, \`rating_kind\` (editorial, rule_derived, measured, unknown), \`computed_at/observed_at NULL\`, \`metadata jsonb\`.
- Example: padel.how categories (0–10) and PadelTrue model-derived power/control/etc remain **distinct data series**, not averaged.

## Published materialized catalogue view

### catalog_releases / release_sources / racket_projections / catalog_state
- \`catalog_releases(id PK, created_at, status [draft, validated, approved, published, superseded], release_number, quality_report jsonb, created_from_run_id)\`.
- \`release_sources(release_id FK, source_snapshot_id FK, PK(release_id, source_snapshot_id))\`.
- \`racket_projections(release_id FK, racket_id FK, shape, weight_min_g, weight_max_g, balance_cm, core_normalized, surface_normalized, extra_attributes jsonb, selected_spec_provenance jsonb, conflict_flags jsonb, PRIMARY KEY(release_id, racket_id))\`.
- \`catalog_state(id boolean PRIMARY KEY CHECK (id=true), active_release_id FK)\`: singleton pointer switched **in one PostgreSQL transaction**, so readers see either previous or new release, never a half-published one.
- Only valid, accepted product matches contribute to projections. Selected values have exact \`spec_observation_id\` provenance. Unresolvable conflict => NULL/flag, not manufactured certainty.
- Build **new projections per release**, not in-place modifications of active rows; rollback is a pointer switch to previously approved release.
- Keep source observations available for detail view and a comparison of competing source values.

## Long-form reviews — reserve schema now, implement in slice 3
- \`review_documents(id, source_id, canonical_url, document_type, author, published_at, language, rights_status, ...)\`.
- \`review_document_versions(id, document_id, content_sha256, storage_path, retrieved_at, extraction_status, parser_version, ...)\`.
- \`review_racket_mentions(document_version_id, racket_id, context_span, match_status, ...)\`: many-to-many; one review may compare several rackets.
- \`review_chunks(id, document_version_id, section_path, start_offset, end_offset, original_language_text, embedding nullable, embedding_model nullable, ...)\`.
- \`review_evidence(id, chunk_id, racket_id, claim_kind, paraphrase, source_span, confidence_label, validation_status, ...)\`.
- Store original-language evidence and any translated paraphrase **separately**. Never point a claim about version 2026 to 2025 by family membership alone.
- Do not materialize complete article text or copyright-restricted snapshots in a public repo.

## Data quality / operations
- \`review_queue(id, kind, target_table, target_id, reason_code, details jsonb, status, reviewer, resolved_at, ...)\`. Queue references IDs; never duplicate sensitive/raw content unnecessarily.
- Run logs and downstream AI/eval tables can be added as slices arrive.
- RLS / roles: publicly displayed catalogue data is read-only and release-scoped; all import/admin writes use server-side credentials only. Source files in private Storage.

## Example normalization policy
- Input \`"365 ± 5 g"\` => \`raw_value="365 ± 5 g"\`; \`value_min=360\`, \`value_max=370\`, \`unit="g"\`, \`approximate/tolerance\` in context.
- Input \`"370 g with one overgrip"\` => \`numeric_value=370\`, \`unit="g"\`, \`measurement_context.grips="1 overgrip"\`; **not** interchangeable with bare weight.
- Input \`"high (head-heavy)"\` => \`normalized_text="head_heavy"\`; \`balance_cm=NULL\`.
- Input \`"~26.5"\` with no clear unit => \`numeric_value=NULL\` in canonical balance until verified, original retained.
- \`player_level="women"\` from a source => invalid as skill level; do not infer \`beginner\`, preserve source input and queue/normalize gender separately.

## Design questions for Codex review (not owner-approved yet)
- Full SQL DDL, FK delete rules, JSON schema validation, indexes and release-build function.
- Single global release pointer vs per-collection release pointers (global recommended initially for deterministic catalogue comparisons).
- Operational thresholds for auto-accept matching and release completeness should come from labeled fixtures, **not** arbitrary fixed confidence percentages.
- How long to retain raw HTML and whether to store extracted clean text in DB or Storage (must respect source rights).
