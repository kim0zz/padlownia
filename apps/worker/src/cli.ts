import { readFile, stat, mkdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { NORMALIZER_VERSION, SnapshotError, type SourceCode } from '@padlownia/domain';
import { openLocalDatabase, createPgExecutor, stageImport, createRelease, evaluateRelease, approveRelease, publishRelease, rollbackRelease, readPublishedCatalogue, setSourcePermission, type SqlExecutor } from '@padlownia/database';
import { devConfig, WorkerError, safeError } from './config.js';
import { LocalSnapshotStore, SupabaseSnapshotStore, type SnapshotStore } from './storage.js';
import { profileSnapshot } from './profile.js';

const help = `Padłownia worker — no LLM and no remote source fetching
  profile --source padeltrue|padelhow --file <path>
  import --source <source> --file <path> [--dry-run | --stage --target local|dev]
  release --runs <run-id,run-id> [--target local|dev]
  gate --release <id> [--target local|dev]
  approve --release <id> --actor <name> --note <review> --explicit-yes [--target local|dev]
  publish|rollback --release <id> --expected <prior-id|none> --actor <name> --explicit-yes [--target local|dev]
  catalogue [--target local|dev]
  demo (local synthetic complete flow; never writes to cloud)
  check-dev (read-only connectivity and restricted-role check)
Local state: .local/worker (one worker at a time). Errors never print credentials or raw inputs.`;
const report = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

async function main(): Promise<void> {
  try { process.loadEnvFile('.env'); } catch { /* Secure environment or explicit fixture mode also work. */ }
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    source: { type: 'string' }, file: { type: 'string' }, target: { type: 'string', default: 'local' },
    'dry-run': { type: 'boolean' }, stage: { type: 'boolean' }, release: { type: 'string' },
    actor: { type: 'string' }, note: { type: 'string' }, expected: { type: 'string' },
    'explicit-yes': { type: 'boolean' }, runs: { type: 'string' }, help: { type: 'boolean' },
  } });
  const command = positionals[0];
  if (values.help || !command) { process.stdout.write(`${help}\n`); return; }
  if (positionals.length !== 1) throw new WorkerError('INVALID_ARGUMENTS');
  if (!['profile','import','release','gate','approve','publish','rollback','catalogue','demo','check-dev'].includes(command)) throw new WorkerError('UNKNOWN_COMMAND');
  const required = (value: string | undefined, name: string): string => { if (!value?.trim()) throw new WorkerError(`${name}_REQUIRED`); return value; };
  const target = values.target;
  if (!['local','dev'].includes(target)) throw new WorkerError('INVALID_TARGET');
  let profiled: ReturnType<typeof profileSnapshot> | undefined;
  let bytes: Buffer | undefined;
  if (command === 'profile' || command === 'import') {
    if (!['padeltrue','padelhow'].includes(values.source ?? '')) throw new WorkerError('INVALID_SOURCE');
    const path = required(values.file, 'FILE');
    if ((await stat(path)).size > 50 * 1024 * 1024) throw new WorkerError('SNAPSHOT_TOO_LARGE');
    bytes = await readFile(path);
    profiled = profileSnapshot(values.source as SourceCode, bytes);
    if (command === 'profile' || values['dry-run'] || !values.stage) { report({ mode: 'dry-run', ...profiled.summary }); return; }
  }
  if (command === 'demo' && target !== 'local') throw new WorkerError('DEMO_IS_LOCAL_ONLY');
  if (['approve','publish','rollback'].includes(command) && !values['explicit-yes']) throw new WorkerError('EXPLICIT_REVIEW_REQUIRED');
  const cloud = target === 'dev' || command === 'check-dev';
  const config = cloud ? devConfig(process.env) : null;
  // Fail before opening a remote DB if Storage cannot preserve the input snapshot.
  const store: SnapshotStore = cloud && command === 'import' ? new SupabaseSnapshotStore(config!) : new LocalSnapshotStore(resolve('.local/worker/storage'));
  const root = resolve('.local/worker');
  let releaseLock: (() => Promise<void>) | undefined;
  if (!cloud) {
    await mkdir(root, { recursive: true });
    try {
      const lockPath = resolve(root, 'worker.lock');
      const lock = await open(lockPath, 'wx', 0o600);
      await lock.writeFile(String(process.pid));
      releaseLock = async () => { await lock.close(); await unlink(lockPath); };
    } catch { throw new WorkerError('LOCAL_WORKER_LOCKED'); }
  }
  let connection: { db: SqlExecutor; close: () => Promise<void> } | undefined;
  try {
    connection = cloud ? createPgExecutor(config!.databaseUrl, process.env.SUPABASE_DB_CA_PEM) : await openLocalDatabase(resolve(root, 'database'));
    const db = connection.db;
    if (cloud) {
      const identity = (await db.query<{ project_ref: string; environment: string }>('select project_ref,environment from padlownia.environment_identity where singleton')).rows[0];
      if (identity?.project_ref !== config!.projectRef || identity.environment !== 'development') throw new WorkerError('DATABASE_DEV_MARKER_MISMATCH');
    }
    if (command === 'import' && profiled && bytes) {
      const storage = await store.put(profiled.parsed.source, bytes);
      const staged = await stageImport(db, { ...profiled.parsed, records: profiled.records, sha256: profiled.summary.sha256, normalizerVersion: NORMALIZER_VERSION, retrievedAt: new Date().toISOString(), storage });
      report({ mode: 'staged', target, ...staged, paidLlmCalls: 0 });
    } else if (command === 'release') {
      report({ releaseId: await createRelease(db, required(values.runs, 'RUNS').split(',')) });
    } else if (command === 'gate') {
      report(await evaluateRelease(db, required(values.release, 'RELEASE')));
    } else if (command === 'approve') {
      report(await approveRelease(db, required(values.release, 'RELEASE'), { actor: required(values.actor, 'ACTOR'), note: required(values.note, 'NOTE') }));
    } else if (command === 'publish' || command === 'rollback') {
      const previous = required(values.expected, 'EXPECTED_PREVIOUS_RELEASE');
      await (command === 'publish' ? publishRelease : rollbackRelease)(db, required(values.release, 'RELEASE'), { actor: required(values.actor, 'ACTOR'), expectedPreviousReleaseId: previous === 'none' ? null : previous });
      report({ status: command === 'publish' ? 'published' : 'rolled-back', releaseId: values.release });
    } else if (command === 'catalogue') {
      report({ target, entries: await readPublishedCatalogue(db) });
    } else if (command === 'check-dev') {
      const check = (await db.query<{ role: string; can_bypass_rls: boolean }>('select current_user as role,rolbypassrls as can_bypass_rls from pg_roles where rolname=current_user')).rows[0];
      if (check?.can_bypass_rls) throw new WorkerError('PRIVILEGED_ROLE_REJECTED');
      report({ connected: true, environment: 'development', projectRef: config!.projectRef, ...check });
    } else if (command === 'demo') {
      // Synthetic permission applies only to this isolated local database, never cloud sources.
      for (const source of ['padeltrue','padelhow'] as const) await setSourcePermission(db, source, { reference: 'tests/fixtures: CC0 synthetic data only', scope: { synthetic: true, localOnly: true } });
      const clean = await readFile('tests/fixtures/demo-clean.synthetic.json');
      const p = profileSnapshot('padeltrue', clean);
      const staged = await stageImport(db, { ...p.parsed, records: p.records, sha256: p.summary.sha256, normalizerVersion: NORMALIZER_VERSION, retrievedAt: new Date().toISOString(), storage: await store.put('padeltrue', clean) });
      const active = (await db.query<{ id: string | null }>('select active_release_id id from padlownia.catalog_state where singleton')).rows[0]?.id ?? null;
      if (active !== staged.releaseId) {
        await approveRelease(db, staged.releaseId, { actor: 'local-synthetic-demo', note: 'Synthetic fixture reviewed by automated gate and golden tests; never real catalogue.' });
        await publishRelease(db, staged.releaseId, { actor: 'local-synthetic-demo', expectedPreviousReleaseId: active });
      }
      report({ mode: 'local-synthetic-demo', ...staged, publishedCount: (await readPublishedCatalogue(db)).length, paidLlmCalls: 0 });
    }
  } finally { await connection?.close(); await releaseLock?.(); }
}

main().catch((error: unknown) => {
  // SnapshotError only carries an enum-style code. Other libraries can embed raw values/secrets.
  report({ status: 'failed', code: error instanceof SnapshotError ? error.code : safeError(error) });
  process.exitCode = 1;
});
