# Sprint 01 — Foundation + Supabase Dev + first catalogue

**Status: engineering brief approved in scope by owner; technical substeps proposed and subject to review**  
**Date:** 2026-10-13  
**Branch:** \`feat/sprint-01-foundation-catalogue\` (or another dedicated feature branch)  
**Deliverable:** reviewable PR; **do not auto-merge**.  
**References:** [PRODUCT](../product/PRODUCT.md), [MVP](../product/MVP.md), [DECISIONS](../product/DECISIONS.md), [AGENTS](../../AGENTS.md), [DATA MODEL](../architecture/DATA_MODEL_V0_1.md), [INGESTION DESIGN](../architecture/INGESTION_DESIGN_V0_1.md), [TEST SCENARIOS](../architecture/INGESTION_TEST_SCENARIOS.md).

## Mission and expected result

Deliver a locally runnable Next.js app **connected to a real, explicitly designated non-production Supabase Cloud project**, with first catalogue records imported through our dedicated worker, a basic searchable UI, traceable source facts and initial tests.

The owner approved **Supabase Dev setup in Sprint 01**; do not defer all cloud work to Sprint 02. The developer agent may prepare/provision/configure a dev project only with **authorized access** and explicit confirmation that the chosen project is **development only**. If authorization/project access is unavailable, implement everything possible without credentials and report the exact one-time owner actions; do not pretend provisioning, migration or import succeeded.

## Workstream 0 — inspect, protect and prepare

- Read \`AGENTS.md\`, product decisions and tech design. Review inconsistencies or proposed details; follow accepted requirements.
- Inspect the actual repo before adding tools; do not overwrite unrelated work.
- Inspect source snapshot formats or small allowed fixtures. Source snapshot counts from discovery (PadelTrue 268, padel.how 217) refer to historical snapshots, not permanent source invariants.
- Keep all work on a feature branch. Changes to secrets, billing, destructive migrations, production projects or public access require separate owner authorization, **outside this sprint**.
- Establish \`DEV_SUPABASE_PROJECT_REF\` and verify project identity **before any remote write**. If unavailable, stop remote writes and report blocker; do not guess identifiers.

## Workstream 1 — monorepo and development ergonomics

- Create Next.js + TypeScript app, separate same-repo worker CLI, shared domain/validation layer, lint, typecheck and test runner; choose simple toolchain pragmatically, document choice.
- Add migrations in \`supabase/migrations/\` and source/release models consistent with P-023–P-030; don't treat proposed table names as immutable requirements.
- Add \`.gitignore\`, \`.env.example\` with **placeholder names only**, and setup instructions. Configure keys via the local developer's secure environment/secret manager (not GitHub/public chat).
- Document startup commands, dev DB reset strategy and basic backup/export procedure. Repo remains public.

## Workstream 2 — Supabase Cloud DEVELOPMENT setup

Prerequisite: **accessible development project with authorized credentials and confirmed dev-only identity**. If none exists, either create a Free-tier project through an authorized management workflow or provide a minimal checklist for the owner to create it. **Never create a paid plan or assume permission to change another project.**

When authorized:
1. Link local Supabase tooling to the specific dev project using the minimum required access. Record project reference as **non-secret local configuration**, not credentials.
2. Review and apply versioned SQL migrations **to dev only**; ensure migration history matches repo.
3. Create **private** Storage buckets for source snapshots and long-form review originals, with no anonymous list/read/write and appropriate content-hash/version naming strategy. Bucket creation should be reproducible through migration/configuration where feasible.
4. Configure database permissions and **RLS with deny-by-default** on source/admin tables. Published catalogue reads must be deliberately restricted or mediated server-side; no anonymous access to raw articles or operational data. Avoid disabling RLS globally.
5. Configure Next.js server/worker connections with environment-specific credentials. Service/secret keys must never be exposed to client bundles, public API responses, logs or commits; never use privileged credentials in browser-side code.
6. Add a dev-only connectivity/storage test and run it safely. Document failures and cloud resources touched.
7. Do not release unverified staging data automatically. Release gate and auditability principles from P-025/P-030 still apply.

No extra paid infrastructure or OpenRouter access is required for this workstream.

## Workstream 3 — adapters, normalization and DB-backed ingestion

- Implement two source-specific connectors: PadelTrue and **detailed** Padel.how \`rackets.json\`; file mode is mandatory, authorized remote fetch is optional. No LLM for structured JSON.
- Parse source records into a common contract; retain source verbatim fields, source attribution, year and variant identity, derived vs editorial ratings, units/configuration and unknowns.
- Implement deterministic normalization, match candidates, high-risk negative cases, ambiguous review queue and a dry-run profiler before cloud writes.
- Make imports **idempotent** and resumable. Save original full-source snapshots in private Storage and compact record payloads in PostgreSQL JSONB; preserve ingestion run status and errors.
- Run first controlled import into **Supabase Dev staging**, review record counts, errors, duplicates, conflicts, source provenance and candidate matches. For actual full catalogues, use verified accessible input snapshots; do not fabricate or commit source files.
- Only publish a vetted dev catalogue release after quality checks (atomic pointer-switch pattern or equivalent). A partially failed import cannot silently become the public catalogue. No production/public release.

## Workstream 4 — visible catalogue slice

- Build searchable catalogue and basic rackets profile in Next.js, **querying approved dev Supabase catalogue read model**, with a clearly labeled local fixture fallback for offline development.
- UI must differentiate manufacturer-declared specs, secondary source observations and editorial/model-derived scores; show unknown/conflicting values.
- Include brand/model/year disambiguation, empty/loading/error states, source links and mobile/keyboard-friendly interaction.
- Apply the vendored UI UX Pro Max skill. Do not build AI chat, complete comparison or paid ingestion in this sprint.

## Workstream 5 — validation and PR handoff

Run and report:
- Typecheck, lint, unit/contract tests; integration tests against dev DB using isolated fixtures where feasible.
- Priority scenarios ING-001–ING-017, ING-021, ING-023, ING-025, ING-028 and ING-032 as applicable; explicitly report skipped scenarios and why.
- Evidence of RLS on sensitive tables, private Storage access denied without privileges, no leaked keys.
- Safe reimport/no-op behavior, partial-failure staging, release blocking, rollback test **only against isolated dev data**.
- Actual import metrics and numbers of successful/failed records, not assumed.
- Working UI walkthrough or screenshots, source-aware sample profile, commands to reproduce.
- PR with changed files, design trade-offs, tested vs untested areas, and which dev resources were created/modified. **No automatic merge.**

## Definition of Done

1. Fresh checkout starts with documented commands; absent credentials produce a clear setup path (no silent fallbacks presented as real data).
2. Repo contains validated, versioned migrations, separate worker, tests and clean secrets handling.
3. A **confirmed dev Supabase project** has schema, private buckets, RLS and working server-side connectivity — **if credentials/access were provided**. Otherwise mark this criterion **blocked**, not completed.
4. The two source formats parse reproducibly and produce staging reports; safe first dev import demonstrated **if accessible source files and dev credentials were available**.
5. Basic catalogue UI actually reads released dev records when configured, with fixture mode clearly identified otherwise.
6. Zero paid LLM/API calls and no third-party article scraping; all third-party attributions and confidentiality restrictions respected.
7. Work delivered on a feature branch as reviewable PR, with test results and explicit blockers.

## Restrictions and stop conditions

- **Allowed cloud mutation:** specifically verified Supabase **development** project only, for planned schema migrations, private Storage and controlled seed/import/test.
- **Not allowed:** production Supabase changes, destructive commands against unknown/existing data, enabling paid tiers, exposed public buckets, putting secret tokens in repo/issues, autonomous recurring jobs, payment plans, arbitrary backend service provisioning, unattended production releases, PR auto-merge.
- If dev Supabase project or secure credentials do not exist, do not invent them and do not change any remote project. Continue local code/migrations/tests, then flag cloud integration as blocked with owner setup steps.
- Any irreversible or ambiguous cloud action must stop pending explicit owner approval.
- If time/scope is constrained, prefer a smaller correctly tested vertical slice and report incomplete work honestly.
- New unapproved high-level architecture decisions should be proposed as ADR, not silently treated as accepted.

## Sprint 02 (not included)

Classic side-by-side comparison, better conflict UX, broader entity resolution UI, text reviews for 20–30 selected rackets, retrieval/eval experiments and longer-term DataOps. Sprint 01 should already have the real Supabase Dev connection when access permits.
