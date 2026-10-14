# ADR-004 — Evidence review and retired import interpretations

- **Status:** Implemented reversible technical choices; accepted product decisions unchanged.
- **Date:** 2026-10-14.
- **Authority:** The owner explicitly delegated review of all 320 source exceptions, with only genuine owner choices to remain open. This authority applies to this audited dataset; it does not enable unattended acceptance of future uncertain matches.

## Context

Two complete source snapshots produced 320 review records. Some issues were parser limitations; others were missing facts, model naming differences or contradictory supplier assertions. Accepting the entire queue without examining these distinctions would hide uncertainty. Rewriting prior observations would destroy reproducibility.

## Choices

1. Audit each queued result against its exact source snapshot and, when useful, a specifically identified review document. Keep private manifests with original result IDs, source URLs, SHA-256, JSON pointers, document hashes and offsets, reason, decision and preserved limitations. Validate referenced bytes and pointers independently before applying decisions. Do not commit source corpora, correspondence or private manifests.
2. Correct deterministic parsing in version `1.2.0`, then reprocess the same snapshots. Earlier outputs remain immutable. Explicit units, approximation and reference/configuration qualifiers can be parsed; unsupported interpretations and conflicts stay unknown or invalid. Source ratings retain their scale and methodology, with missing-input and currency caveats visible.
3. A missing year remains `null`, distinct from a known-year product. Preserve unresolved variants and color qualifiers. Merge names only with specific evidence for the same model, variant and year; broad lexical resemblance is insufficient. Seven reviewed aliases in this dataset meet that requirement. This is a set of audited decisions, not a relaxed global matcher.
4. `applySourceReview()` requires a stable target, source hash and URL, specific evidence, reviewer, rationale and expected prior match. It records an explicit match/review outcome without changing original fields or validation statuses. An identical replay is harmless; stale or changed decisions fail closed. Pinned releases cannot be edited. The gate still rejects pending reviews, invalid records, missing rights and unsupported projection values.
5. An unpublished complete interpretation may be marked `superseded` by a complete, differently versioned run of the same source snapshot and record count. Retire its queue entries with an explicit successor reference, not a claim that the old interpretation became correct. Retired runs cannot be reactivated or published. Supersession is interpretation retirement, not acceptance of the successor: its own review and publication gates remain mandatory. The actual Dev workflow applies successor reviews before retiring predecessors.
6. Serialize run lifecycle transitions and release approval with compatible ordered locks. Guard direct SQL transitions as well as the service API. Preserve previous releases, raw rows and observations; no destructive reset or deletion is needed.
7. Record source permission evidence separately from technical correctness. The verified padel.how correspondence supports the described attributed catalogue/comparison; PadelTrue data uses CC BY 4.0. Neither decision publishes full review text, photos, downloadable source datasets, embeddings or training data. The exact scope is documented in the permission review.

## Consequences

The reviewed catalogue can include honest unknowns with source attribution while omitting unsupported scalar values from its main projection. An accepted review means the treatment is justified, not that every source claim is independently measured or complete. An owner need not invent missing facts.

Private evidence and receipts permit later investigation; public documentation reports aggregate outcomes and examples. There is no automatic merge approval policy for future imports, paid LLM call, public text retrieval or new production deployment. A dedicated review UI and general deletion/withdrawal orchestration remain outside Sprint 01.

See [source review results](../development/SOURCE_REVIEW_RESULTS_2026_10_14.md), [permission scope](../development/SOURCE_PERMISSION_REVIEW.md) and [test coverage](../development/TEST_COVERAGE.md).
