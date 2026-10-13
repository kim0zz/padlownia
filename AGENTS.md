# AGENTS.md — Padłownia

## Mission
Build a trustworthy, low-cost, source-grounded padel racket catalogue, comparison UI and AI assistant. Owner focuses on architecture, rules, retrieval and evals; Codex writes the detailed implementation. Separate design decisions from implementation.

## Read first
1. `docs/product/DECISIONS.md` — accepted, proposed and open items.
2. `docs/product/PRODUCT.md` and `docs/product/MVP.md`.
3. `docs/architecture/OVERVIEW.md` and relevant `docs/adr/*`.
4. `docs/ai/ROLES.md` for optional role-based delegation.

Never promote a proposal to accepted without the owner's explicit choice.

## Non-negotiable rules
- Runtime AI chat uses **only vetted internal database data**. No web research during user conversations; ingestion worker is the separate internet-connected component.
- Source attribution must travel from raw record to each displayed spec, rating, reviewer observation and AI inference. Cite specific evidence. Preserve variants, model years and conflicting observations.
- Do not invent numeric product scores or imply first-hand tests when not verified.
- Keep source snapshots versioned, canonical entities separate, uncertain matches in human review. LLM is advisory when matching records.
- Prefer deterministic extractors and validations; apply LLM when it demonstrably adds value.
- Source-dependent deletion includes chunks, embeddings and derived caches. Respect permission notes.
- Public repo: never commit secrets, real `.env` files, user data or third-party article datasets. Use placeholders in `.env.example`.
- AI spending ceiling: 100 PLN per month. Log token/cost/latency, track eval baselines and enforce caps.

## Target structure (not yet implemented)
```text
apps/web/            Next.js frontend + API
apps/worker/         ingestion, extraction, indexing, eval jobs
packages/domain/     shared validation, types and normalization
packages/ai/         gateway, retrieval and output contracts
supabase/migrations/ database schema revisions
evals/               golden sets and benchmark reports
docs/                product, design, architecture, ADRs
.agents/skills/      reusable task playbooks
```
Keep a single repo and modular boundaries; avoid premature distributed infrastructure.

## Working agreement
1. Inspect current repository and source-of-truth docs.
2. Explain architecture choices and trade-offs in plain language, then implement the smallest usable vertical slice.
3. Add migrations/tests/evals with changes; never claim unrun checks passed.
4. Report what changed, how to reproduce, test results, costs and unresolved issues.
5. For architecture changes propose an ADR; don't silently override approved choices.
6. Delegate bounded roles when useful; don't create a swarm of agents merely for appearance.

## Roles and reusable skills
Defined at `docs/ai/ROLES.md`. Initial opt-in skills:
- `.agents/skills/source-profiling/SKILL.md`
- `.agents/skills/entity-resolution-eval/SKILL.md`
- `.agents/skills/rag-evaluation/SKILL.md`

A skill is a repeatable workflow, not a separate AI subscription or runtime framework. See ADR-001 on deferring agent orchestration frameworks.
