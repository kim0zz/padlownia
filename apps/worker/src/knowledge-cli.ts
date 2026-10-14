import { readFile, mkdir, writeFile, stat, readdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { assertDevelopmentDatabase, createPgExecutor, openLocalDatabase, stageKnowledge } from '@padlownia/database';
import { catalogueLinks, parseKnowledge, parseReviewDetail, knowledgeSummary, searchKnowledge, type KnowledgeCorpus, type CatalogueLink } from './knowledge.js';
import { fetchReviewDetail, type ReviewFetchProvenance } from './review-fetch.js';
import { LocalSnapshotStore, SupabaseSnapshotStore, sha256 } from './storage.js';
import { devConfig, safeError, WorkerError } from './config.js';
const report = (value: unknown) => process.stdout.write(JSON.stringify(value,null,2) + '\n');
const readBounded = async (file: string) => {
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new WorkerError('KNOWLEDGE_TOO_LARGE');
  return readFile(file);
};
async function main() {
  try { process.loadEnvFile('.env'); } catch { /* Explicit process env supported. */ }
  const { positionals,values } = parseArgs({ allowPositionals: true,options: {
    file: { type: 'string' },catalogue: { type: 'string' },query: { type: 'string' },slug: { type: 'string' },limit: { type: 'string' },
    pilot: { type: 'string' },target: { type: 'string',default: 'local' },help: { type: 'boolean' },
  } });
  const command = positionals[0];
  if (!command || values.help) { process.stdout.write('Private knowledge worker (unreviewed evidence; no AI calls/publication)\n  profile|search|stage --file <llms file> --catalogue <detailed padelhow JSON> [--query <text> --slug <exact source slug> --limit 5] [--target local|dev]\n  fetch-reviews --catalogue <JSON> --pilot <selection JSON containing records[].slug> (max 30; saves private .local files)\n  stage-reviews --catalogue <JSON> [--target local|dev] (stages previously fetched private files only)\n'); return; }
  if (positionals.length !== 1 || !['profile','search','stage','fetch-reviews','stage-reviews'].includes(command)) throw new WorkerError('KNOWLEDGE_COMMAND_INVALID');
  if (!values.catalogue) throw new WorkerError('CATALOGUE_REQUIRED');
  if (!['local','dev'].includes(values.target)) throw new WorkerError('INVALID_TARGET');
  const catalogueBytes = await readBounded(values.catalogue), links = catalogueLinks(catalogueBytes);
  const downloadRoot = resolve('.local/knowledge/review-details');
  const provenanceRoot = resolve(downloadRoot,'provenance');
  const readProvenance = async (bytes: Uint8Array, record: CatalogueLink): Promise<ReviewFetchProvenance | null> => {
    try {
      const provenance = JSON.parse((await readFile(resolve(provenanceRoot,sha256(bytes) + '.json'),'utf8'))) as ReviewFetchProvenance;
      if (provenance.sha256 !== sha256(bytes) || provenance.sourceUrl !== record.jsonUrl || !Number.isFinite(Date.parse(provenance.fetchedAt))) throw new WorkerError('REVIEW_PROVENANCE_INVALID');
      return provenance;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  };
  if (command === 'fetch-reviews') {
    if (!values.pilot) throw new WorkerError('EXPLICIT_REVIEW_PILOT_REQUIRED');
    const pilot = JSON.parse((await readBounded(values.pilot)).toString('utf8')) as { records?: { slug?: unknown }[] };
    if (!Array.isArray(pilot.records) || !pilot.records.length || pilot.records.length > 30) throw new WorkerError('PILOT_SIZE_INVALID');
    const selected = pilot.records.map(record => links.find(link => link.slug === record.slug));
    if (selected.some(record => !record) || new Set(selected.map(r => r!.slug)).size !== selected.length) throw new WorkerError('PILOT_IDENTITY_INVALID');
    await mkdir(downloadRoot,{ recursive: true });
    await mkdir(provenanceRoot,{ recursive: true });
    const results = [];
    for (const record of selected as CatalogueLink[]) {
      let bytes: Uint8Array | undefined;
      try { bytes = await readBounded(resolve(downloadRoot,record.slug + '.json')); parseReviewDetail(bytes,record); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const cached = Boolean(bytes);
      let provenance = bytes ? await readProvenance(bytes,record) : null;
      if (!bytes) { const fetched = await fetchReviewDetail(record); bytes = fetched.bytes; provenance = fetched.provenance; }
      await writeFile(resolve(downloadRoot,sha256(bytes) + '.json'),bytes,{ flag: 'wx',mode: 0o600 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
      if (sha256(await readFile(resolve(downloadRoot,sha256(bytes) + '.json'))) !== sha256(bytes)) throw new WorkerError('REVIEW_CACHE_HASH_MISMATCH');
      if (provenance) await writeFile(resolve(provenanceRoot,sha256(bytes) + '.json'),JSON.stringify(provenance),{ flag: 'wx',mode: 0o600 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
      if (!cached) await writeFile(resolve(downloadRoot,record.slug + '.json'),bytes,{ flag: 'wx',mode: 0o600 });
      results.push({ slug: record.slug,sha256: sha256(bytes),bytes: bytes.byteLength,cached,fetchTimestampKnown: Boolean(provenance) });
      if (!cached) await new Promise(done => setTimeout(done,500));
    }
    report({ source: 'padelhow',fetched: results.filter(r => !r.cached).length,cached: results.filter(r => r.cached).length,results,paidLlmCalls: 0 });
    return;
  }
  const items: { bytes: Uint8Array; corpus: KnowledgeCorpus; provenance?: ReviewFetchProvenance | null }[] = [];
  if (command === 'stage-reviews') {
    for (const file of (await readdir(downloadRoot)).filter(file => file.endsWith('.json') && !/^[a-f0-9]{64}\.json$/.test(file)).sort()) {
      const record = links.find(link => link.slug + '.json' === file);
      if (!record) throw new WorkerError('REVIEW_IDENTITY_MISMATCH');
      const bytes = await readBounded(resolve(downloadRoot,file));
      items.push({ bytes,corpus: parseReviewDetail(bytes,record),provenance: await readProvenance(bytes,record) });
    }
    if (!items.length || items.length > 30) throw new WorkerError('PILOT_SIZE_INVALID');
  } else {
    if (!values.file) throw new WorkerError('FILE_REQUIRED');
    const bytes = await readBounded(values.file);
    items.push({ bytes,corpus: parseKnowledge(bytes,links) });
  }
  if (command === 'profile') { report(knowledgeSummary(items[0]!.corpus)); return; }
  if (command === 'search') {
    report({ mode: 'private-source-audit',results: searchKnowledge(items[0]!.corpus,values.query ?? '',{ slug: values.slug,limit: Number(values.limit ?? 5) }),paidLlmCalls: 0 });
    return;
  }
  const cloud = values.target === 'dev', config = cloud ? devConfig(process.env) : null;
  const store = config ? new SupabaseSnapshotStore(config) : new LocalSnapshotStore(resolve('.local/knowledge/storage'));
  let releaseLock: (() => Promise<void>) | undefined;
  if (!cloud) {
    const root = resolve('.local/knowledge');
    await mkdir(root,{ recursive: true });
    const lockPath = resolve(root,'worker.lock');
    const lock = await open(lockPath,'wx',0o600).catch(() => { throw new WorkerError('LOCAL_WORKER_LOCKED'); });
    releaseLock = async () => { await lock.close(); await unlink(lockPath); };
  }
  let connection: ReturnType<typeof createPgExecutor> | undefined;
  try {
    connection = config ? createPgExecutor(config.databaseUrl,process.env.SUPABASE_DB_CA_PEM) : await openLocalDatabase(resolve('.local/knowledge/database'));
    await assertDevelopmentDatabase(connection.db,config?.projectRef ?? 'local');
    for (const { bytes,corpus,provenance } of items) {
      const storage = await store.putOriginal('padelhow',bytes,corpus.format);
      const documents = corpus.documents.map(doc => ({
        ordinal: doc.ordinal,sourcePath: doc.sourcePath,url: doc.url,title: doc.title,locale: doc.locale,kind: doc.kind,
        sha256: doc.sha256,characterStart: doc.characterStart,characterEnd: doc.characterEnd,productSlugs: doc.productSlugs,issues: doc.issues,
      }));
      const result = await stageKnowledge(connection.db,{ source: 'padelhow',sha256: corpus.sha256,bytes: corpus.bytes,parserVersion: corpus.parserVersion,format: corpus.format,
        retrievedAt: provenance?.fetchedAt ?? new Date().toISOString(),storage,sourceMetadata: { catalogueSha256: sha256(catalogueBytes),publication: 'private_unreviewed',offsetUnit: 'UTF-16 code units',
          retrievalBasis: provenance ? 'recorded_http_fetch' : 'local_file_observation_original_fetch_unknown',
          httpSourceUrl: provenance?.sourceUrl ?? null,httpLastModified: provenance?.lastModified ?? null,httpEtag: provenance?.etag ?? null },documents });
      report({ target: values.target,...result,...knowledgeSummary(corpus) });
    }
  } finally { await connection?.close(); await releaseLock?.(); }
}
main().catch(error => { report({ status: 'failed',code: safeError(error) }); process.exitCode = 1; });
