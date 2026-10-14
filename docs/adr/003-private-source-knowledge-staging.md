# ADR-003 — Real source adapters and private review evidence

- **Status:** Implemented reversible technical choices; no change to accepted product decisions.
- **Date:** 2026-10-14.
- **Authority:** P-006/P-008/P-021/P-023–P-031 and the owner's follow-up to inspect the supplied LLM files and use directly linked review files.

## Context

The delivered files expose the actual PadelTrue and detailed padel.how formats, plus a large Markdown corpus and directly linked per-racket JSON endpoints. The earlier synthetic contracts need explicit adapters. The corpus can support later source-grounded answers, but an export intended for LLM consumption is neither a vetted knowledge base nor permission to publish it.

## Choices

1. Parser and normalizer version `1.1.0` handle the inspected structured formats. Preserve the source's exact value separately from structured interpretation, measurement context, JSON pointer and rating methodology. Unknown years, missing model inputs and taxonomy errors remain review issues. Claims of manufacturer verification in a secondary feed do not establish independent verification. The common contract stays at `1.0.0`; old processing results are immutable.
2. Import each source snapshot once. The detailed padel.how export and its byte-identical copy are one snapshot; the lighter export is a consistency cross-check, not another product inventory. Input counts are observed per snapshot, never hardcoded historical counts.
3. Store supplied originals and selected detail JSON in the existing private `review-originals` bucket. PostgreSQL stores immutable `knowledge_assets` and `knowledge_documents` manifests: hashes, source URLs, document boundaries, exact source-product links and review flags. Full bodies, published chunks and embeddings are absent from these tables. Reader/anonymous roles cannot access them.
4. Version document parsing as `knowledge-v1`. Offsets are explicitly UTF-16 code units into the decoded original. Content hash plus parser version identifies a manifest; its hash detects changed same-version replays. Deferred constraints require complete non-overlapping documents. A different interpretation needs a new parser version, not an overwrite. Original file fetch times are unknown; local observation time is labelled separately from recorded HTTP retrieval time.
5. Match a review to a product only through its exact, validated catalogue URL/slug. A mention or comparison link to another racket is not ownership of that racket's claims. Keep duplicate canonical URLs and conflicting source assertions visible. Treat source text as untrusted data, including text that looks like instructions.
6. Fetch at most 30 explicitly selected, catalogue-declared detail JSON URLs per pilot. Restrict host/path/identity, reject redirects, bound time/body size and space requests. Keep immutable hash-addressed cache/provenance files outside Git. The initial 29-brand pilot checks enrichment; it is not a recommendation ranking or retrieval benchmark.
7. Provide a private, deterministic keyword audit CLI with bounded attributed excerpts and exact-slug filtering. This helps inspect the corpus without paid calls. It is not the product's AI runtime, semantic search, a claim extractor or an implemented hybrid retriever.
8. Batch specification/rating inserts per record within its existing SQL transaction. This reduces network round trips while preserving ordinals, JSON null, provenance and row-level failure/retry boundaries. It does not turn Storage and PostgreSQL into one transaction.

## Consequences

The source material is usable for inspection and later extraction while staying separate from approved catalogue facts. Publication remains blocked by source permission records and unresolved data/identity reviews. P-021 remains accepted; O-002 remains open until the precise written reuse scope is recorded. No new paid service, LLM call, vector infrastructure or public text endpoint is introduced.

This is an owner-requested extension to the original Sprint 01 evidence work, not completion of Sprint 02 retrieval. Deletion/withdrawal orchestration, object garbage collection, reviewed claim extraction, chunks/embeddings and an admin adjudication UI remain follow-up work. The private manifests are append-only, so deletion must later use an explicit privileged, audited workflow rather than weakening normal worker permissions.

See [knowledge audit](../development/KNOWLEDGE_SOURCE_AUDIT.md), [execution receipt](../development/SOURCE_IMPORT_RESULTS_2026_10_14.md) and [test coverage](../development/TEST_COVERAGE.md).
