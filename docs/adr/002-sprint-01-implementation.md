# ADR-002 — Sprint 01 implementation baseline

- **Status:** Implemented technical baseline; reversible engineering choices, not new accepted product decisions.
- **Date:** 2026-10-13.
- **Scope:** Foundation, structured ingestion and the first catalogue slice.
- **Authority:** [Decision register](../product/DECISIONS.md), especially P-008/P-009/P-012/P-013/P-023–P-031, and [Sprint 01 brief](../development/SPRINT_01_BRIEF.md).

## Context

The real-source follow-up is recorded in [ADR-003](003-private-source-knowledge-staging.md). It supersedes the initial synthetic-only compatibility boundary below and adds private evidence manifests; the original baseline is retained here as implementation history.

The repository began with product decisions and proposed architecture documents. Sprint 01 needs executable boundaries, deterministic ingestion and a reviewable catalogue without paid services or runtime AI calls. The proposed table names and TypeScript sketches were not immutable product requirements.

This ADR records the resulting technical choices. It does not promote proposed/open items in the decision register to Accepted, authorize production operations, settle source reuse permissions or certify an actual source import. Deployment state, commands actually executed and cloud evidence belong in the sprint handoff report.

## Implemented choices

### 1. One npm workspace and small modules

Use TypeScript, npm workspaces and the committed lockfile. `npm ci` reproduces the dependency resolution. Next.js App Router lives in `apps/web`; an explicit CLI in `apps/worker` owns ingestion. `packages/domain` contains pure contracts, parsers, normalization, entity resolution and value selection. `packages/database` owns PostgreSQL persistence and the published read model behind a small `SqlExecutor` interface. Vitest tests these boundaries; Playwright covers visible catalogue behavior.

The web imports only the database reader/executor entry points; it does not bundle the PGlite test runtime or worker operations. No orchestration framework, hosted queue or AI gateway implementation is needed for this slice, consistent with [ADR-001](001-defer-agent-framework.md). These modules can be split or replaced later without changing product identities or source history.

### 2. PGlite executes local SQL; it is not a Supabase emulator

PGlite provides actual PostgreSQL execution for isolated tests and the offline worker demo. Tests apply the repository migrations after a minimal local-only shim defining the Supabase-style roles and Storage metadata tables used by those migrations. A persistent local worker database is protected by a single-process lock and local migration checksums.

This avoids requiring Docker or cloud credentials for the core pipeline. It verifies transactions, constraints, functions, role grants and RLS in PostgreSQL. It does **not** implement Supabase Auth, Storage HTTP, signed download URLs, the management API, network behavior or every cloud role restriction. Local success cannot certify remote migration, connectivity or private-object access. The shim must never be applied to a Supabase project. A real local Supabase stack or disposable PostgreSQL service can be added through the same executor boundary.

### 3. File-only connectors with an explicit compatibility limit

The worker reads a bounded local file; `parseSnapshot` is synchronous and has no I/O. PadelTrue and detailed padel.how adapters produce a common versioned contract. The contract carries original payloads, external identity scope, JSON-pointer evidence, observations, ratings, contextual metadata and structured issues. Unparseable rows remain explicit errors rather than disappearing from counts.

No actual PadelTrue or padel.how input snapshots were supplied during connector implementation. The supported shapes are therefore **synthetic contract fixtures based on the brief**, not verified compatibility with live catalogues. [The domain contract](../../packages/domain/README.md) specifies those shapes and limitations. The historical 268/217 counts are not hard-coded invariants or achieved import metrics. Before a real import, profile the complete authorized file and version any required adapter changes. No remote source fetching, article scraping or LLM extraction was added.

### 4. Conservative normalization and exact entity resolution

Normalization preserves verbatim input separately from its typed interpretation. Units must be explicit in the value or context; field suffixes alone are not proof. Numeric balance additionally needs a reference to the butt/handle base. Ranges, tolerances and supported overgrip context survive parsing. Unsupported configurations, unknown units and semantic errors require review. Source-specific rating scales, category keys and editorial/rule-derived classifications remain distinct.

Exact normalized brand, full model including variant tokens, and a known explicit year define automatic matching. Plus signs remain meaningful. Unknown-year identities and ambiguous aliases go to review; no fuzzy threshold enables an automatic merge. The synthetic gold set has 12 positive pairs and 14 hard negatives. Its results measure only those labelled cases, not real-catalogue accuracy. Source slugs are never canonical UUIDs. Family relationships are represented in the schema but are not automatically inferred in this slice.

Manufacturer attribution received from an aggregator starts unverified even if the source supplies a `verified` property. Explicit review must establish provenance for the precise product before manufacturer precedence applies. The projection selector excludes specimen measurements and editorial assessments from main physical specifications. Equal-priority conflicting observations leave the value unknown; lower-priority alternatives remain visible with conflict flags. This implements P-023/P-027 without inventing a statistical acceptance threshold.

### 5. Immutable inputs, versioned processing results

Full input bytes use SHA-256-addressed private object paths. Compact source rows are keyed by snapshot plus input index, so duplicated upstream IDs are retained instead of being silently dropped. Duplicate external IDs block publication. PostgreSQL stores raw payload hashes, source attribution and immutable object pointers.

Parsing/normalization outputs belong to an ingestion run through `record_results`; observations, ratings and matching decisions refer to that result. This is a technical refinement of the proposed direct source-record relationship: changing a parser version can reuse immutable input while preserving both interpretations. Idempotency includes source, snapshot hash, parser/normalizer/matcher versions and the processing mode. Identical replay resumes or reuses records; each row transaction commits independently.

Storage and PostgreSQL cannot share one transaction. The worker writes and verifies the immutable object before staging its reference. A failed SQL write may leave an orphan object; object reuse/hash checking and row retries are implemented, but automated orphan inventory/garbage collection is deferred. A release cannot reference storage marked unverified.

### 6. Draft construction, explicit approval and atomic publication

A release pins one run per selected source. Building a draft is separate from approving or publishing it. Rebuilding an existing draft refreshes its projections after explicit match review; approved history is pinned against evidence inserts and changes. Source observations and processing outputs remain append-only.

The initial gate blocks incomplete counts, duplicate IDs, invalid records, unresolved/rejected reviews, unaccepted identities, absent source permission, unverified storage, omitted active sources, missing provenance and ineligible canonical evidence. This conservative fail-closed policy is a reversible technical baseline; it is not an owner-approved numeric quality threshold or permission to publish partial catalogues. The diff includes source ratings and observation/provenance content as well as selected physical fields, excluding generated IDs and retrieval timestamps.

`approve_release` records an actor, note and gate result. `activate_release` rechecks the gate, locks the singleton pointer, checks the caller's expected previous release and switches status/pointer/audit atomically. Rollback targets an earlier published release and retains current rights/evidence checks; it may legitimately predate a subsequently added source. Import alone does not publish. The CLI's automatic demonstration publication is restricted to its explicit local synthetic demo.

Exception review is currently audited database work; an admin review UI and general correction workflow are deferred. Invalid immutable processing results require corrected/versioned reprocessing. Same-key replay avoids a new release; semantic deduplication of otherwise identical outputs across different parser runs is not a complete release-suppression policy yet.

### 7. Private schema, constrained roles and server-only access

The application uses a private `padlownia` schema, with RLS on application tables and no raw-table access for `anon`, `authenticated` or the catalogue reader. The reader can execute a fixed published-catalogue function. The ingestion role can stage/build drafts, but cannot directly change the active pointer, release publication status or publication audit. Narrow security-definer functions mediate the approved operations; their schema/search path and execution grants are explicit. These functions are privileged APIs, not substitutes for missing access-control design.

`source-snapshots` and `review-originals` are private. Restrictive object policies deny browser-role access to these buckets even in the presence of unrelated permissive policies. The schema fails if a colliding existing bucket is public rather than silently changing it. These choices align with Supabase's documented [Storage policy model](https://supabase.com/docs/guides/storage/security/access-control) and [RLS/grant separation](https://supabase.com/docs/guides/database/postgres/row-level-security).

Next.js connects server-side with a dedicated reader login; no privileged key belongs in a browser bundle or `NEXT_PUBLIC_` variable. Source/admin payloads and private object paths are absent from the public read model. Provider errors are replaced with safe codes. Source links accept HTTP(S) without embedded credentials, and source text is rendered as data.

### 8. Development identity must precede cloud writes

Cloud worker operations require explicit development confirmation, a designated project reference, the matching HTTPS API origin, a restricted database login and a database development-identity marker. PostgreSQL URLs require exactly one `sslmode=verify-full`; query parameters cannot override the validated host/user or weaken TLS. Storage requests refuse redirects, check bucket privacy and verify returned content hashes. Secrets and role provisioning remain environment-specific and outside committed migrations.

The existence of this code is not evidence that credentials, the marker, roles or remote resources have been configured. A connected management tool is also not equivalent to a working Next.js/worker application connection. Actual verified project identity, resources touched and outstanding setup must be recorded separately. No production target is authorized by this ADR.

### 9. Explicit UI modes and source-aware presentation

The catalogue uses classic GET search, brand/year/shape filtering and exact-profile routes. AI chat and complete comparison remain outside Sprint 01. UI choices and use of the required UI UX Pro Max skill are recorded in the [design note](../design/SPRINT_01_DESIGN.md).

`CATALOGUE_MODE=supabase` reads only the released database function; failures render setup/unavailable states. `CATALOGUE_MODE=fixture` explicitly displays authored fictional rackets with prominent notices. Missing configuration, an empty release or a failed connection never silently activates fixtures. The UI fixtures and the local worker's synthetic published dataset are separate development demonstrations. Starting one does not prove the other is connected. Local web scripts bind to loopback; a shared hosted demo still needs its separately reviewed access arrangement.

## Consequences and follow-up boundaries

The baseline is runnable without cloud access and protects prior published state when an import fails. It adds explicit review work for uncertain data and intentionally favors unparsed/unknown values over inferred facts. The small SQL/executor boundary makes a future hosted or local database replacement possible without duplicating domain logic.

Full-source compatibility/profiling, written permission scope, a real development import and application connectivity require separate evidence. Text reviews, embeddings/vector retrieval, source-deletion cascades, object garbage collection, fuzzy matching, AI extraction, scheduling and public deployment are not asserted as implemented. Source permission withdrawal currently fails closed; complete deletion/rebuild orchestration remains deferred.

Once a migration is applied to any shared development database, change its behavior through an additive migration, not by editing its history. Revisit these choices when real snapshot profiles, concurrency, release diffs or measured costs demonstrate a need. [Test coverage](../development/TEST_COVERAGE.md) records what the current checks actually exercise.
