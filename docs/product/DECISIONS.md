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
