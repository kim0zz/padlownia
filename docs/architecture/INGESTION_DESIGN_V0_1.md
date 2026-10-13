# Ingestion Architecture & Contracts v0.1

**Status: PROPOSED, intended for Codex review before implementation**  
**Date:** 2026-10-13  
**Accepted constraints:** P-006 to P-009, P-023 to P-030 in [DECISIONS.md](../product/DECISIONS.md).  
**Related:** [DATA_MODEL_V0_1.md](./DATA_MODEL_V0_1.md), [INGESTION_TEST_SCENARIOS.md](./INGESTION_TEST_SCENARIOS.md).

## Goals and non-goals

Build a **controlled, repeatable, testable, observable** ETL+AI pipeline for PadelTrue and padel.how. New review sources later add connector implementations without rewriting source-independent validation and persistence. The first implementation does not need LangGraph, hosted queues, cron services, browser agents, or paid LLM calls.

Non-goals for slice 1: autonomous source discovery, complete French/Spanish article scraping, review summarization, scheduled cloud workers, dynamic pricing, fully automated repairs or user-facing external web browsing.

## End-to-end flow

\`\`\`text
explicit import command / local worker
  -> connector.fetch() [offline file or approved remote endpoint]
  -> snapshot hash + private Storage write
  -> source_snapshots + ingestion_runs [durable audit]
  -> connector.parse()  [source-specific, no LLM for JSON]
  -> canonical ingestion envelopes
  -> validate identity + source values
  -> normalized source_records, spec_observations, source_ratings
  -> entity matching proposals / auto-accept / review_queue
  -> draft projection + completeness/conflict report
  -> explicit publication gate
  -> transaction: new catalog_release + projections + pointer switch
  -> public API queries **published release only**
\`\`\`

No stage should mutate previously published records or remove the last good catalogue as a side effect of a failed import.

## Source-specific adapters

Use a small interface per supplier, without special-casing supplier fields in generic business logic. Suggested TypeScript contract (illustrative; final Zod schemas and types belong in the code):

\`\`\`ts
type SourceCode = "padeltrue" | "padelhow";
type SourcePayload = {
  source: SourceCode;
  externalId: string;
  sourceUrl?: string;
  identity: { brand: string; name: string; year?: number | null };
  observations: Array<{
    key: string;
    rawValue: unknown;
    rawSourcePath: string;
    kind: "manufacturer_declared" | "retailer_claim" |
          "measured_specimen" | "editorial_assessment" | "unknown";
    contextualMetadata?: Record<string, unknown>;
  }>;
  ratings: Array<{
    key: string;
    rawValue: unknown;
    scale: { min: number; max: number };
    methodology: string;
    kind: "editorial" | "rule_derived" | "measured" | "unknown";
  }>;
  rawPayload: unknown; // copied exactly from parsed source JSON
};

interface SourceConnector {
  sourceCode: SourceCode;
  fetch(input: { location: string; mode: "file" | "remote" }): Promise<{
    bytes: Uint8Array;
    retrievedAt: string;
    canonicalSourceUrl?: string;
    declaredVersion?: string;
  }>;
  parse(bytes: Uint8Array): Promise<{
    declaredCount?: number;
    records: SourcePayload[];
    recordErrors: Array<{ inputIndex: number; errorCode: string; details: string }>;
  }>;
}
\`\`\`

**Clarifications:**
- This envelope carries source observations and provenance, not one final "correct" mass, shape, score or year.
- The canonical DB ID is **not** \`externalId\` (PadelTrue slug and padel.how slug remain source-specific).
- \`rawSourcePath\` can be JSON pointer, section ID, or parser offset. It must enable audit against the saved snapshot.
- The worker validates the adapter output at its boundary; adapters may pass along problematic records as structured errors instead of crashing a batch.
- For a source row lacking stable slug/ID, produce a snapshot-scoped deterministic substitute plus an explicit warning; never pretend to have cross-snapshot identity.
- \`SourceCode\` union can be extended by adding a connector, not by teaching a general-purpose LLM new HTML formats.

### PadelTrue adapter (structured JSON)
- Read published snapshot containing racket records and nested specs/scores.
- Keep individual spec source attribution where present (manufacturer vs retailer). **The aggregator itself is not a manufacturer**; provenance must come from explicit evidence.
- Scores are **derived from technical characteristics by its methodology**, not physical test measurements. Preserve its original scale and methodology version.
- Price values may use different currencies; avoid cross-currency comparison without exchange rates/observation time.
- Preserve raw date/year nulls and known upstream conflict annotations as context.

### padel.how adapter (structured JSON)
- Prefer detailed **\`rackets.json\`**, not duplicate lightweight **\`data/rackets.json\`** feed, for initial catalogue adapter. Both supplied snapshots cover 217 source rows and 10 rating categories, but detailed feed adds links, characteristics, offers and metadata.
- Field values such as \`weight_g\`, \`balance_cm\`, \`thickness_mm\` often remain free-form strings, **despite field names**. Do not call Number(...) directly and assume valid units.
- Distinguish overall score (0–100) from ten category scores (0–10); preserve scoring methodology and their exact source category keys.
- Treat \`player_level="women"\` as a semantic validation problem, not an actual skill level.
- If supplied, map product page URL, \`markdown_url\`, \`json_url\`, \`image\` and dated retailer links as metadata. Images are links only; rights to redistribute photos need separate confirmation.
- The owner's message permitted use of portal data as reported by the project owner; retain source permission record and exact scope, not an assumed unlimited blanket license.

### Review/article adapter (slice 3)
- Per-domain extraction of original-language title, author, date, headline hierarchy and content sections.
- Many-to-many document-to-racket relationships; section/claim variant matching, not “all article claims belong to all mentioned rackets”.
- Non-review press releases tagged separately. Content/rights fields required before enabling storage and embeddings.
- Begin with Padel.how article links. Padel Magazine, Time2Padel and PadelZoom remain **candidate source pilots, not approved deployments**.

## Normalization & matching boundaries

**Two-step normalization**: (1) parse and classify with deterministic functions; (2) produce \`NormalizedObservation\` only if evidence is sufficient. Keep \`raw_value\` and parse warnings regardless. Use LLM extraction only in a separately versioned, budget-controlled path for harder text, after golden tests exist.

Priority for displayed physical specs:
1. Verified **manufacturer declaration** matching exact product variant/year and comparable measurement protocol;
2. If missing, carefully selected secondary catalogue claim **clearly labelled**;
3. If neither supported, NULL/unknown, not invented data.

Measured specimens and subjective observations are **independent evidence**; do not silently overwrite a manufacturer's nominal specification. Log meaningful contradictions even within the same source.

Entity Resolution:
- Candidate blocking by normalized brand; strong consideration of product family, variant tokens and year.
- Positive match requires the **same exact product**, not just high name similarity. Negative traps include Soft vs hard, 12K vs 18K, CTRL vs Attack, Pro vs Pro+, Lite vs non-Lite, 2025 vs 2026.
- \`auto_accepted\` only for explicitly evaluated high-precision deterministic rules. All ambiguous suggestions must enter human review; never auto-merge from arbitrary fuzzy scores.
- New canonical racket creation is allowed when unique identity is supported; unknown-year and missing-variant identity cases are flagged.
- Version and audit the rule set and reviewer decisions; match must be reversible.

## Operational state machines

Model statuses separately: **run**, **per-record**, **release**. Do not overload one status field to represent all three.

### Ingestion run
\`\`\`text
queued -> fetching -> fetched -> parsing -> validating -> matching -> staged
                                \                 \             \
                                 -> failed         -> partial    -> review_required
staged/review_required -> quality_checked -> completed
any recoverable stage -> failed_retryable -> retrying -> prior stage
any unrecoverable stage -> failed_terminal
\`\`\`

The transitions above are logical stages; implementation may simplify to stable states + \`current_stage\`, but must retain a trace of events and failure reasons. \`completed\` means the run has been processed into staging, **not automatically published**.

### Per record
\`\`\`text
received -> parsed -> valid -> matched / new_identity -> staged
                 \-> invalid -> quarantined -> corrected -> revalidated
                     valid but ambiguous -> needs_match_review -> accepted/rejected
\`\`\`
A record rejected for canonical linking may still be retained as a valid source observation; never delete its raw payload.

### Catalogue release
\`\`\`text
draft -> evaluated -> review_required/approved -> published -> superseded
                           |                      |
                           v                      v
                        rejected                rollback target
\`\`\`
- Failed publication does **not** leave partially active rows.
- Published history is immutable. Rollback switches active pointer to an earlier approved release atomically.
- An incomplete import must not be represented as a full refreshed source. An **explicitly approved** partial release may be permitted only with disclosed coverage and preserved prior data; default is block and escalate.

## Publication gate (proposed policy, not hard-coded thresholds)

Before publication, compute and persist:
1. Source expected count vs parsed count, record error count, unique IDs, duplicates, schema version/checksum.
2. Required identity coverage (brand/model and meaningful variant/year constraints), parse status and canonical match outcome.
3. Fatal errors, quarantines, pending reviewer decisions and conflict severity; distinguish blocking from informational warnings.
4. Diff against active release: created/updated/missing rackets; specs changed with provenance; sources removed or unavailable.
5. Rights/source policy state and any removal requests.
6. Idempotency and migration/schema compatibility; no dangling Storage pointers.

Initial thresholds and automatic promotion rules must be approved **after reviewing real error distributions**. For the night-1 task: generate a gate report and keep it in **draft**; do not auto-publish to a cloud DB.

## Transactions, failures & reprocessing

- Snapshot ingestion starts by computing SHA-256 and writing private immutable file to Storage (when configured); insert/lookup \`source_snapshots\` with metadata and pointer. A failed DB insert may leave an orphan Storage object; log and clean it via controlled GC.
- Use deterministic \`idempotency_key\` = source + snapshot hash + parser/normalizer version + processing mode. A replay with the same key is a safe no-op or resume, never an additional published version.
- Insert source records and observations in bounded DB transactions; failed row must not block other rows. Avoid transaction across external Storage + PostgreSQL (cannot be atomic); implement compensation and consistency checks.
- Retry transient network/429/5xx errors with bounded exponential backoff and jitter; permanent schema/identity errors go to exception queue, not endless retries.
- Parser version bump can reprocess existing cached snapshots without fetching internet again; input hash unchanged, output run/version changed.
- Publication: create candidate projections for an immutable release, validate them, then atomically swap \`catalog_state.active_release_id\` in a single short DB transaction. Concurrent publication attempts require lock/check current release to avoid lost updates.
- No destructive updates to active source history. Rollback affects the public active view; changing an import audit log alone must not alter public data.
- Removing an unauthorized source requires invalidating affected published projections, chunks, embeddings and derived cached responses, and publishing a compliant successor release.

## Security, budget and environment

- Public repository: only synthetic/generic fixtures or small source-derived facts when permitted; **not** full copied articles, database exports or credentials.
- Cloud Storage buckets for source artifacts are **private**, with least-privilege server credentials. No unauthenticated write endpoints.
- First implementation should support **offline file mode**, no Supabase project/keys required. Later cloud mode is opt-in. Never hard-code private data into frontend bundles.
- Structured JSON ingestion should need **zero paid LLM calls**. Only approved, bounded AI experiments run from worker, with logs for model, tokens, currency, cost and ceiling of 100 PLN per month.
- Treat retrieved HTML/article text as untrusted input and potential prompt injection. Strip scripts; never execute scraped instructions.

## Suggested worker CLI (proposed)

\`\`\`text
pnpm worker:profile --source padelhow --file <local-path>
pnpm worker:import --source padelhow --file <local-path> --dry-run
pnpm worker:import --source padeltrue --file <local-path> --dry-run
pnpm worker:import --source padelhow --file <local-path> --stage
pnpm worker:gate --release <draft-release-id> --report
pnpm worker:publish --release <approved-release-id> --explicit-yes
pnpm worker:rollback --release <previous-approved-id> --explicit-yes
\`\`\`

**Important:** commands are **intended API**, not existing scripts. Exact flags/paths can change during implementation; never claim they already execute.

## Initial implementation order for Codex

1. Domain schemas + type fixtures for one PadelTrue and one padel.how record, including tricky free-form values.
2. Two offline file connectors + source profiling; avoid remote network first.
3. Normalization functions and identity candidate generation with negative-case tests.
4. SQL migration skeleton for sources/snapshots/records/rackets/observations/matching/review queue/release pointer.
5. Safe dry-run import summary and simulated publication gate; implement live Storage and Supabase writes only after separate environment review.
6. Only then simple searchable catalogue UI built on approved/projection seed records.

Review [INGESTION_TEST_SCENARIOS.md](./INGESTION_TEST_SCENARIOS.md) for acceptance cases.
