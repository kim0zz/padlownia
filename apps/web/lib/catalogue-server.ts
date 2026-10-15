import 'server-only';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertDevelopmentDatabase, sharedPgExecutor } from '@padlownia/database/executor';
import { readPublishedCatalogue, type CatalogueEntry } from '@padlownia/database/catalogue';
import { fixtureCatalogue } from './fixtures';
import { CatalogueSetupError, resolveCatalogueConfig, type CatalogueConfig } from './config';
import { loadCatalogueImages } from './catalogue-images-server';

export type CatalogueResult =
  | { status: 'ready'; mode: 'fixture' | 'snapshot' | 'supabase'; entries: CatalogueEntry[] }
  | { status: 'setup' | 'unavailable'; entries: [] };

export async function getCatalogue(): Promise<CatalogueResult> {
  try {
    const config = resolveCatalogueConfig(process.env);
    if (config.mode === 'fixture') return { status: 'ready', mode: 'fixture', entries: fixtureCatalogue };
    if (config.mode === 'snapshot') return { status: 'ready', mode: 'snapshot', entries: await loadCatalogueImages(await readSnapshot(config.path)) };
    return { status: 'ready', mode: 'supabase', entries: await cachedSupabaseCatalogue(config) };
  } catch (error) {
    // Never echo provider errors: connection strings and source payloads can appear in them.
    return { status: error instanceof CatalogueSetupError ? 'setup' : 'unavailable', entries: [] };
  }
}

/**
 * The published catalogue changes only when a release is activated or a source is withdrawn, but reading it
 * costs ~1 s (published_catalogue(), several MB). Serve it from memory for CATALOGUE_TTL_MS, then refresh in the
 * background while still serving the cached copy; past CATALOGUE_MAX_STALE_MS a request waits for fresh data.
 * The web role cannot read the active release ID cheaply yet (needs a migration), so freshness is time-based.
 */
const CATALOGUE_TTL_MS = 60_000;
const CATALOGUE_MAX_STALE_MS = 10 * 60_000;
type SupabaseConfig = Extract<CatalogueConfig, { mode: 'supabase' }>;
let catalogueCache: { target: string; entries: CatalogueEntry[]; loadedAt: number } | null = null;
let catalogueLoad: { target: string; promise: Promise<CatalogueEntry[]> } | null = null;
const verifiedTargets = new Set<string>();

async function cachedSupabaseCatalogue(config: SupabaseConfig): Promise<CatalogueEntry[]> {
  const target = `${config.projectRef}\n${config.databaseUrl}`;
  const cached = catalogueCache?.target === target ? catalogueCache : null;
  const age = cached ? Date.now() - cached.loadedAt : Infinity;
  if (cached && age <= CATALOGUE_TTL_MS) return cached.entries;
  if (cached && age <= CATALOGUE_MAX_STALE_MS) {
    loadSupabaseCatalogue(config, target).catch(() => {}); // a failed refresh keeps the cached copy until max stale
    return cached.entries;
  }
  return loadSupabaseCatalogue(config, target);
}

/** One read at a time per target: concurrent requests share it instead of each running published_catalogue(). */
function loadSupabaseCatalogue(config: SupabaseConfig, target: string): Promise<CatalogueEntry[]> {
  if (catalogueLoad?.target === target) return catalogueLoad.promise;
  const promise = (async () => {
    const db = sharedPgExecutor(config.databaseUrl, process.env.SUPABASE_DB_CA_PEM);
    // The identity marker is immutable, so verify it once per pool, before that pool's first catalogue read.
    if (!verifiedTargets.has(target)) { await assertDevelopmentDatabase(db, config.projectRef); verifiedTargets.add(target); }
    const entries = await loadCatalogueImages(await readPublishedCatalogue(db));
    catalogueCache = { target, entries, loadedAt: Date.now() };
    return entries;
  })().finally(() => { if (catalogueLoad?.promise === promise) catalogueLoad = null; });
  catalogueLoad = { target, promise };
  return promise;
}

/** Minimal shape check for a local export of `published_catalogue()`: one release, unique IDs, list fields present. */
export function parseCatalogueSnapshot(text: string): CatalogueEntry[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('SNAPSHOT_INVALID');
  const ids = new Set<string>();
  const releases = new Set<string>();
  for (const entry of data as Record<string, unknown>[]) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || typeof entry.releaseId !== 'string'
      || typeof entry.brand !== 'string' || typeof entry.model !== 'string' || !Array.isArray(entry.specs) || !Array.isArray(entry.ratings)
      || ids.has(entry.id)) throw new Error('SNAPSHOT_INVALID');
    ids.add(entry.id); releases.add(entry.releaseId);
  }
  if (releases.size > 1) throw new Error('SNAPSHOT_INVALID');
  return data as CatalogueEntry[];
}

let snapshotCache: { path: string; entries: CatalogueEntry[] } | null = null;
async function readSnapshot(path: string): Promise<CatalogueEntry[]> {
  const absolute = resolve(process.env.INIT_CWD ?? process.cwd(), path);
  if (snapshotCache?.path === absolute) return snapshotCache.entries;
  const entries = parseCatalogueSnapshot(await readFile(absolute, 'utf8'));
  snapshotCache = { path: absolute, entries };
  return entries;
}
