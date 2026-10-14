# Development database

Apply the numbered `migrations/*.sql` files in order **only to the explicitly verified development project**. The migration files are the real Supabase schema; `packages/database/src/local.ts` contains a separate minimal Storage/role shim used only by local PostgreSQL tests. Never apply that shim to Supabase.

The custom `padlownia` schema is not a public REST API. The web server reads `padlownia.published_catalogue()` using a dedicated login granted `padlownia_reader`. Its result has only fixed, release-scoped catalogue fields and source attribution. Raw payloads, private object paths, permission correspondence references and ingestion diagnostics are absent from the read model. Browser code receives no database credentials.

The ingestion login is granted `padlownia_worker`. This role can stage source records and build drafts, but it cannot directly change the active release pointer, publish status or publication audit. `approve_release()` evaluates the gate and records an explicit actor/note. `activate_release()` evaluates the gate again, locks the active pointer, checks the expected previous release and atomically switches it. The worker must use these functions. Login/password provisioning is environment-specific; no passwords are included in migrations.

The runtime migration creates `padlownia_web` and `padlownia_ingest` as **NOLOGIN**, without passwords. Trusted development provisioning supplies separate secrets and enables LOGIN; the migration never overwrites colliding role names. It also creates an immutable `environment_identity` table. Cloud provisioning inserts the verified project reference separately; local PGlite inserts `local`. Both runtime roles can read the marker and neither can change it. The server and worker verify it with `assertDevelopmentDatabase()` before using the connection.

`createPgExecutor()` parses the connection URI into explicit host, port, database and credential fields, never passes arbitrary URI options to `pg`, and always verifies TLS certificates/hostnames. The only optional query string is `sslmode=verify-full`; options that change host/user or weaken TLS are rejected. The caller must additionally verify the configured Supabase project hostname/reference and dedicated runtime username.

Every application table has RLS enabled. Anonymous/authenticated clients receive no privileges or policies in the application schema. Both `source-snapshots` and `review-originals` buckets are private. Restrictive Storage object policies deny anonymous/authenticated reads and writes to those buckets even when unrelated permissive Storage policies exist. An existing public bucket with one of these names makes the migration fail; it is not silently changed.

## Import and release invariants

- Input bytes are stored privately and hash-verified before a snapshot is declared verified. PostgreSQL does not pretend to make object storage and SQL one transaction. A failed SQL commit can leave an orphan object for explicit reconciliation; no release may reference unverified storage.
- Raw rows are keyed by snapshot and input index, preserving duplicate upstream IDs as evidence. Duplicate IDs block a complete release. A record-processing result is scoped to an ingestion run, so a parser version change preserves prior outputs while reusing the same snapshot/raw rows.
- A run idempotency key includes source, snapshot SHA-256, parser, normalizer and matching rule versions. Each row is committed independently. A failed SQL transaction leaves earlier rows available, marks the run retryable, and replay resumes without duplicate observations.
- Drafts can be rebuilt after an explicit review. Approval pins the exact run set; inserts into pinned results/evidence/matches and edits to published projections are blocked. Source data and observations are append-only.
- The gate rejects incomplete counts, duplicate IDs, invalid/unreviewed records, unaccepted identities, missing rights, unverified storage, omitted active sources, unbacked values and ineligible specimen/opinion values. Initial policy is conservative blocking, not an invented statistical accuracy threshold.
- The diff includes selected physical fields, all source observations, ratings and attribution, ignoring generated IDs and retrieval timestamps. Ratings stay in their source-specific scales and methodologies.
- Rollback requires a previously published release, expected-current-pointer check and current rights/evidence validity. It may return to an earlier catalogue predating an added source. Permission withdrawal makes the reader fail closed for the affected active release, pending an explicitly reviewed compliant successor.

## Migration history and runtime provisioning

The seven schema migration filenames use the exact versions/names returned by the
confirmed Dev management API. Two additional **history-only marker migrations**
(`20261014052903` and `20261014053339`) represent environment-specific encrypted
runtime credential provisioning and removal of its temporary handoff table.
Their original SQL is intentionally not replayed or committed. Thus the version
list matches Dev; SQL-content parity is claimed only for the seven schema migrations,
not the two explicitly labelled operational markers. Replaying this repository
creates the schema and NOLOGIN runtime roles, never copies Dev passwords or its
project identity marker into another database.

Dev migrations were applied through the authorized Supabase management connector.
Runtime connections are configured in ignored local environment files. A Supabase
CLI account link/access token was not provisioned; do not interpret working runtime
connections as a successful `supabase link`. Before future CLI push/pull work,
verify the selected project and inspect migration history, preserving the distinction
above. Never run migration repair/reset against an unverified target.

Initial local demo databases used pre-application migration filenames. They were
archived under `.local/worker-before-migration-name-alignment` and recreated rather
than bypassing the checksum guard. A fresh checkout uses the aligned names directly.

## Local checks and reset

From the repository root, run `npm test -- --run tests/database`. The suite opens isolated in-memory PGlite databases (actual PostgreSQL execution) and applies the exact migrations after the local-only Supabase shim. It tests RLS and roles, but is **not** an emulator for Supabase Auth, Storage HTTP or the management API. Cloud connectivity and Storage HTTP require separate development-only checks.

`openLocalDatabase(path)` persists an offline development database. Do not open one PGlite directory from multiple processes. Stop the worker before backing up or resetting that directory. A local reset deletes only the explicitly selected `.local` development database directory and reopens it; never run remote reset or destructive migration commands. Migration hashes are recorded locally: changing an applied migration fails closed and requires either a fresh disposable database or a new migration.

For a development backup, export the application schema/data with a trusted PostgreSQL backup tool into an ignored, access-controlled directory and separately inventory/copy the private Storage objects. Keep checksums and release IDs with the backup. Database exports contain private source content and must not enter Git or public CI artifacts. Restore only into a new confirmed development database and verify the gate and private bucket policies before making it readable.

## Current boundaries

The source follow-up adds private knowledge assets/documents: immutable metadata
manifests for the archived LLM corpus and directly linked review JSON. Full text
stays in private Storage. The worker can SELECT/INSERT these manifests; browser
roles and the catalogue reader cannot read them. Deferred completeness constraints
and manifest hashes reject partial writes and changed same-version replays.
Their only rights state is private staging/unreviewed; no public text retrieval,
embeddings or claim extraction is enabled by this schema.

Reviewed claim/chunk/embedding tables, source deletion orchestration and object garbage collection are deferred. No vector extension is required before vector retrieval exists. Human exception adjudication currently uses audited database records; an admin review UI is outside Sprint 01. A pending or invalid record cannot be bypassed just by approving a release.

The development Supabase security advisor reported no security findings after all seven schema migrations, including private knowledge staging. All 21 application tables have RLS enabled. Supporting foreign-key indexes address the non-singleton join paths identified by the earlier performance advisor. The active-release foreign-key index advisory is intentionally left for the one-row `catalog_state` table. Unused-index notices on a newly empty database do not establish that an ingestion/evidence index should be removed; recheck after representative imports.
