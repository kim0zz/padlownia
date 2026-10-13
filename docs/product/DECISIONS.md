# Decision Register

Recorded 2026-10-13. **Accepted** means explicitly selected by project owner in conversation. **Proposed** means architect recommendation only. Do not silently change a decision status.

| ID | Status | Topic | Decision / rationale |
|---|---|---|---|
| P-001 | Accepted | Product | Polish-first padel racket catalogue, profiles, comparison and AI-enhanced insights; multi-language-capable design. |
| P-002 | Accepted | UX | Hybrid: **separate** classical search and AI prompt, but shared chosen-racket/comparison context and reused UI components. |
| P-003 | Accepted | AI intents | Natural-language search by features, racket stats, pairwise comparison, multi-turn follow-ups, model/year disambiguation. |
| P-004 | Accepted | Grounding | User-facing AI sees only imported database content; no runtime external search; may infer cautiously without inventing facts/history. |
| P-005 | Accepted | Citations | Cite sources adjacent to substantive borrowed information and AI conclusions; separate facts, opinions, inference. |
| P-006 | Accepted | Structured data | Import full available PadelTrue and padel.how snapshots; start long-form reviews for 20–30 rackets. |
| P-007 | Accepted | ETL | Controlled ETL + AI (A), later episodic autonomous research agent (C) with validation gate. |
| P-008 | Accepted | Entity resolution | Auto-accept high-confidence exact matches; queue ambiguous matches; source originals preserved. |
| P-009 | Accepted | Extraction quality | Automated data validation plus human exceptions and sampled accepted-result checks. |
| P-010 | Accepted | Retrieval | SQL + full-text + vector hybrid; future experiments with agentic retrieval, not initial production dependency. |
| P-011 | Accepted | UI | Chat outputs structured component payloads; frontend renders vetted cards/stats/comparison/evidence components. |
| P-012 | Accepted | Stack | Next.js + TypeScript, Supabase Cloud Free PostgreSQL+pgvector, local app development, Vercel for later demo. |
| P-013 | Accepted | Worker | Separate worker in same repo, initially local execution, separate from user-facing Next.js runtime. |
| P-014 | Accepted | Model integration | OpenRouter initially with replaceable internal Model Gateway; direct vendor integrations possible later. |
| P-015 | Accepted | Model choice | Single benchmarked default model for friends; private experiment panel to compare models; routing later. |
| P-016 | Accepted | Evals | Golden set and automated checks; may add LLM-as-a-Judge after calibration; manual-only evaluation rejected. |
| P-017 | Accepted | Budget | AI API spend **ceiling** 100 PLN per month; prefer cheap models and better data/retrieval/context, not maximizing spend. |
| P-018 | Accepted | Access | Private for owner and a few friends; no full account system initially. |
| P-019 | Accepted | DataOps | Smart C: review queue, run history, quality/cost monitoring; stage advanced functionality, avoid excessive infra. |
| P-020 | Accepted | AI-first development | Agent/Codex implements code; owner learns business logic, architecture, retrieval, agent/context engineering and evals. Good AGENTS.md, scoped roles and reusable skills when useful. |
| P-021 | Accepted | Source reuse | padel.how owner responded positively to portal data use; written correspondence must be retained and precise permitted scope tracked. |
| P-022 | Accepted | Design skills workflow | Use UI UX Pro Max for design and implementation; later use Impeccable as an independent review/polish pass. Install locally per project; avoid overlapping always-on design guidance. |
| P-023 | Accepted | Catalogue source precedence | Manufacturer-declared specifications take precedence as the main catalogue value. Preserve differing catalogue observations separately with provenance; distinguish a measured individual specimen from a manufacturer declaration and disclose meaningful conflicts. Reviewer impressions complement or challenge claimed playing characteristics, never silently replace physical specs. If a manufacturer value is missing or evidently erroneous, flag for verification rather than invent a resolution. |
| P-024 | Accepted | Product identity and model families | Each exact racket variant and model year is a distinct canonical product with its own specs, ratings, and review evidence. Related products may belong to a shared model family (e.g., NOX AT10 Genius), enabling navigation and year-to-year/variant comparison without conflating identities. Never transfer variant/year-specific claims between family members without explicit evidence. |
| P-025 | Accepted | Source import versioning and publication | Persist versioned source snapshots/observations with retrieval timestamps and content hashes. Detect and validate changes, publish a new active dataset version only after checks, support rollback to prior accepted state, and pin data versions for reproducible retrieval and evals. Avoid silent overwrites and full event sourcing at MVP scale. |
| P-026 | Accepted | Hybrid racket specification schema | Store frequently queried canonical specification fields as typed columns (e.g., shape, weight range, balance, core/surface where normalized); retain extensible additional attributes without schema migrations for each novel property. Preserve every source's verbatim observations and provenance separately from selected canonical values. Only promote validated, comparable observations; distinguish manufacturer declarations, measured specimens and subjective assessments. |
| P-027 | Accepted | Source observation representation | Persist the exact verbatim original value plus a typed normalized interpretation and explicit context (source provenance, declaration vs measured value vs opinion, measurement units/configuration, parsing/validation status, unknowns). Treat missing unit/configuration as unknown, never guessed; keep raw source values even if normalization fails. Example: 365 ± 5 g may yield normalized 360–370 g while preserving the original notation and uncertainty. |
| P-028 | Accepted | Hybrid storage for ingestion | Keep compact per-item source payloads and normalized/operational metadata in PostgreSQL (including JSONB for source-specific fields). Store full input snapshots and large original documents (HTML/Markdown/JSON) as versioned private objects in Supabase Storage; PostgreSQL holds immutable pointers, source attribution, content hashes and processing/publication status. Use one ingestion worker to coordinate writes, detect partial failures and support reprocessing/rollback. No extra storage subscription or separate blob service required at MVP scale. |
| T-001 | Accepted | Agent framework | Defer LangGraph/LangChain and orchestration frameworks until measured need; see ADR-001. |
| D-001 | Proposed | Schema | Separate canonical rackets, source records, specs/ratings/evidence and source permissions. |
| D-002 | Proposed | Git layout | `apps/web`, `apps/worker`, `packages/domain`, `packages/ai`, `evals`, `supabase`. |
| D-003 | Proposed | Access | Simple invitation code plus rate limits instead of user accounts. |
| D-004 | Proposed | MVP delivery | Vertical slices from catalogue through compare, RAG, assistant and Smart DataOps; tests/logs from the outset. |
| D-005 | Proposed | Extraction | Deterministic parsing first, LLM for hard cases with schema validation and human review exceptions. |
| O-001 | Open | Additional review sources | Padel Magazine / Time2Padel / PadelZoom remain **candidates**; pilot extractor and assess rights/relevance. Pádel Nuestro not selected. |
| O-002 | Open | Text rights | Verify documented scope of padel.how owner's approval, including indexing, embeddings and public-demo display; keep permission on record. |
| O-003 | Open | Evaluation design | Exact gold set, pass thresholds and quality-vs-cost targets to set from baseline. |
| O-004 | Open | Model and embeddings | Initial model, embedding model, chunking and retrieval ranking parameters subject to benchmarks. |
| O-005 | Open | Storage/ops | Precise document storage, worker trigger and backup/retention plan; choose with real constraints. |

## Change control
- Record new choices here as Accepted only after project owner explicitly selects them.
- For architectural trade-offs add an ADR under `docs/adr/`.
- Distinguish implementation fact from intended direction. This repo began empty; docs describe future architecture, not existing code.
