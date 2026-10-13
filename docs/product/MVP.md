# MVP Plan — Vertical Slices

Status: **Agreed goals; implementation milestones proposed**. Planning is iterative. Import and data operations start with basic instrumentation rather than being postponed to the final stage.

## MVP data scope
- Import full structured snapshots: PadelTrue 268 source records; padel.how 217 source records.
- Select 20–30 rackets for long-form review ingestion/retrieval experiments. Begin with rights-cleared padel.how text and carefully selected additional source pilots.
- Establish manually adjudicated gold pairs, variant/year traps and review evidence questions.

## Vertical slices (proposed delivery order)
1. **Foundation and catalogue**: Next.js/TypeScript app, Supabase Free migration strategy, dedicated same-repo worker, snapshot import, immutable source records, first matching and review queue, basic catalogue, autocomplete and racket profiles.
2. **Classic comparison**: choose two precise variants, show specs, multiple sources, category ratings, source citations, missing values and conflicts. No LLM needed for this path.
3. **Text evidence and hybrid retrieval**: importer/parser for permitted review content, document versioning, article-to-many-rackets matching, chunks, extracted statements with evidence IDs, full-text + pgvector retrieval and offline evals. Pilot across varied article layouts.
4. **Assistant and dynamic UI**: OpenRouter-backed replaceable model gateway; structured intent/schema outputs; lookup, search, stats, pairwise comparison and follow-up questions with current UI context, no internet at runtime.
5. **Smart DataOps and AI Lab**: expand audit UI, exceptions, run history, retries, cost dashboards, golden eval comparisons across models. Pilot LLM-as-judge only after validating against human judgments.
6. **Optional experiments**: agentic retrieval versus deterministic hybrid retrieval; wave-based autonomous content discovery through the same validation pipeline; later multi-model routing and scheduled ingest.

## Definition of done (each slice)
- End-to-end demo based on actual selected records; no fabricated samples masquerading as production data.
- Unit/integration checks, schema validation and relevant gold tests.
- Clear handling of missing/ambiguous/conflicting data.
- Traceable links from visible facts to source observation/evidence; no broken assertions.
- No secrets in repository and no unrestricted background cost exposure.
- Logs sufficient to diagnose failures, trace model calls and compare cost/quality.
- Document deviations in ADR/decision register.

## Deliberately not in first demo
General user registration and personalized long-term profiling; pricing automation for Polish stores; sophisticated multi-agent operations; paid queue infrastructure; arbitrary LLM-generated UI; unrestricted live web browsing by user-facing assistant.
