# Architecture Overview v0.1 (Proposed)

This document is a **design hypothesis**, not an assertion that the system exists. Technology choices in DECISIONS.md are accepted; internal module/table names below remain proposed.

## Components

```text
Owner/friends
  |-- classic search/catalogue/compare (no LLM)
  +-- AI assistant -> structured output and known UI components
                  |
                Next.js API -- [Model Gateway -> OpenRouter initially]
                  |
     [SQL + full-text + pgvector retriever] -- Supabase PostgreSQL
                                                  ^
Local worker (same repo) --------------------------|
  |-- PadelTrue + padel.how snapshot ingesters
  |-- optional authorized article parsers
  |-- deterministic normalization + AI extraction
  |-- identity matching + human review queue
  |-- evidence chunks, embeddings, eval runs
  +-- job/run logs and spend tracking
```

## Data provenance (conceptual)
- `rackets`: canonical entity with variant and model year.
- `source_records`: raw versioned inputs, source ID, source URL, retrieved timestamp and content hash.
- `source_entity_matches`: adjudicated relationships between source records and canonical rackets (confidence, reviewer, reason).
- `spec_observations`: original strings, parsed ranges/units and measurement context (e.g., overgrip/no overgrip).
- `source_ratings`: original source-specific scales, dimensions, methodology and version. Do not average blindly.
- `review_documents`: original-language article and source metadata, permissions, version/hash; many-to-many to rackets.
- `review_chunks`, `review_evidence`: source-anchored fragments/claims, reviewer inference vs opinion, variant and section/timestamp.
- `ingestion_runs`, `review_queue`, `model_calls`, `eval_runs`: operational traceability.

## Query flow
1. Parse user intent and reference to selected entities; ask disambiguation if model/year unclear.
2. Deterministic catalogue/SQL queries first.
3. For textual insights retrieve via full-text + vectors, constrained by resolved racket IDs; rerank by relevance and evidence quality.
4. Build minimal cited context; model can **interpret** but not invent evidence, extrapolate exact scores or use internet tools.
5. Validate structured response schemas, evidence IDs and permissible UI component types server-side.
6. Render catalogue/profile/comparison/explanation through the same canonical widgets.

## Security, reliability and spend
- Public repo: secret scanning; server-only credentials, no external article snapshots committed.
- Code-access invitation/rate-limits for private demo; admin actions separately protected.
- Worker retries with idempotency keys and document/version hashes, manual exception queue, sampled QA.
- Permission-aware source removal including embeddings and derived text.
- Instrument provider/model, latency, token count, estimated/actual cost and golden-eval result.
- AI spending ceiling 100 PLN/month, checked before nonessential runs.

## Development constraints
- Ship vertical slices; defer distributed queues, managed orchestration and agent frameworks.
- Prefer measured outcomes over additional abstraction. Keep code testable and feature flags on experimental retrieval/agent tools.
- Next design tasks: canonical schema v0.1, ingestion state machine, gold datasets, API/UI contracts and initial cost instrumentation.
