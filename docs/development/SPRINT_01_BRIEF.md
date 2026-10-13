# Sprint 01 — Foundation + first offline catalogue slice

**Status: PROPOSED development brief / READY FOR REVIEW, not yet executed**  
**Date:** 2026-10-13  
**Branch:** \`feat/sprint-01-foundation-catalogue\` (suggested; create if available)  
**Deliverable:** reviewed PR; do not auto-merge.  
**Inputs:** [PRODUCT.md](../product/PRODUCT.md), [MVP.md](../product/MVP.md), [DECISIONS.md](../product/DECISIONS.md), [AGENTS.md](../../AGENTS.md), [DATA_MODEL_V0_1.md](../architecture/DATA_MODEL_V0_1.md), [INGESTION_DESIGN_V0_1.md](../architecture/INGESTION_DESIGN_V0_1.md), [INGESTION_TEST_SCENARIOS.md](../architecture/INGESTION_TEST_SCENARIOS.md).

## Mission
Deliver the smallest **end-to-end, locally runnable** system validating our two catalogue formats, preserving original values and provenance, and showing a searchable initial catalogue screen. The architecture must later connect to Supabase Cloud without rewriting application/domain logic.

## Scope

### Phase 0 — verify design and input shape
- Read approved decisions first; identify gaps in the **proposed** schema and contracts without silently changing accepted principles.
- Inspect actual PadelTrue and padel.how records if available from an authorized location / user-provided local file. Note which dataset/version each fixture represents. Do not invent columns from unsupported assumptions.
- Write any necessary technical ADR proposals before irreversible architecture changes; preserve questions as proposals.
- Define a minimal release-manifest + entity-identity mapping that supports staging and multiple versions.

### Phase 1 — foundation
- Bootstrap lightweight single-repo TypeScript project: Next.js, worker CLI, shared validation/domain module, lint, typecheck and test runner.
- Versioned PostgreSQL/Supabase migration **files** with FK, unique/index and basic safety constraints for source/snapshot, record, entity, observation, rating, matching, audit and release. No live cloud migration in this sprint.
- \`.env.example\`, clear local setup instructions. Secret files excluded; no admin key in frontend.

### Phase 2 — connectors and normalization
- Two file-mode structured JSON adapters: PadelTrue and **detailed** padel.how \`rackets.json\`.
- Strict source-specific validation + shared envelope. Preserve \`rawPayload\`, field-level raw values and provenance.
- Deterministic parsers for simple weights, ranges, balanced/numeric shapes. Unsupported descriptions stay raw/unknown and flagged; no invented values.
- Import dry-run profiling that reports records, invalid values, coverage and candidate identity matching (no LLM).
- Versioned matching suggestions + manual exception queue data model; do not auto-merge high-risk similar variants.
- Capture source-specific rating dimension and methodology (editorial vs rule-derived).
- Support idempotent fixture reruns, sample conflict reports and staging-only outcome. Avoid live Supabase and Storage credentials at this stage.

### Phase 3 — visible slice
- Create catalogue UI, classic search and filtering using a local fixture/read model abstraction. Mark clearly when the dataset is only a fixture (not full production content).
- Include source attribution, empty/loading/error states and a compact racket profile view. Don't build chat, full comparison or RAG now.
- Apply project-level \`ui-ux-pro-max\` skill for UI planning and implementation. Document design decisions; Impeccable comes later.
- Use reusable components so classic and future AI paths share racket card/profile representations.

### Phase 4 — tests & review package
- Run typecheck, lint, unit/contract tests and available integration tests. Report exactly which tests ran vs skipped.
- Cover **P0 scenarios achievable offline**, prioritizing ING-001 to ING-014 and ING-021, ING-025, ING-028; explicitly list tests requiring actual DB/Storage which are pending.
- Generate sample dry-run data quality report including invalid values and no unsafe auto-merge.
- PR description: changed files, commands, screenshots or clear UI walkthrough, actual data fixtures, schema assumptions, failing/unsupported cases, next sprint boundary.

## Non-goals & restrictions
- **No production or cloud Supabase modifications**, no provisioning service, no cloud login required.
- **No paid LLM API calls** or embeddings, no OpenRouter key, no recurring schedules.
- **No crawling of new review sites**, importing articles, long-form RAG or autonomous source research.
- No accounts/auth system, admin backend, continuous background job runner or full blown queues.
- No raw copyrighted review corpora, credentials or private correspondence in public Git.
- No forced certainty on manufacturer source identity: source feed claims require attribution checks.

## Definition of Done
1. A fresh clone can install/run the repo using documented commands, without private API keys.
2. Both source JSON **formats** can be parsed from a path on disk with unit tests and a reproducible dry-run report.
3. Safe handling of invalid rows, missing units, exact-year/variant identity traps and two independent score methodologies is demonstrated.
4. Database schema migrations are in Git and reviewed for consistency; if PG is locally available, integration test it; otherwise mark unexecuted explicitly.
5. First catalogue screen works with labelled fixture data and has at least basic responsive, keyboard and error-state checks.
6. Code changes are on a dedicated branch with PR for human review; **no auto-merge**, no writes to production resources and zero paid API calls.
7. All deviations from this brief are described, not quietly expanded.

## Ordering and stop conditions
- Prefer **correct ingestion + minimal visible UI** over an oversized application.
- If actual source payloads cannot be acquired safely, implement connectors against **small declared sample fixtures**, mark full-data import as blocked, and do not claim completion for full catalogues.
- If blocked by any external credential, do not invent one; mock the integration and document exact next step.
- If scope grows, finish a smaller tested checkpoint and report it in the PR rather than weakening validation.
- Owner approvals are required for new significant tech decisions; suggested implementation details may be chosen pragmatically and documented.

## Handoff to Sprint 02 (not included)
Full snapshot import into an explicitly designated non-production Supabase environment and private Storage; real release promotion/rollback transaction; complete entity resolution queue and source disagreement display; catalogue extended toward compare UI.
