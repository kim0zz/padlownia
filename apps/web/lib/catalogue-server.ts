import 'server-only';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertDevelopmentDatabase, createPgExecutor } from '@padlownia/database/executor';
import { readPublishedCatalogue, type CatalogueEntry } from '@padlownia/database/catalogue';
import { fixtureCatalogue } from './fixtures';
import { CatalogueSetupError, resolveCatalogueConfig } from './config';
import { loadCatalogueImages } from './catalogue-images-server';

export type CatalogueResult =
  | { status: 'ready'; mode: 'fixture' | 'snapshot' | 'supabase'; entries: CatalogueEntry[] }
  | { status: 'setup' | 'unavailable'; entries: [] };

export async function getCatalogue(): Promise<CatalogueResult> {
  try {
    const config = resolveCatalogueConfig(process.env);
    if (config.mode === 'fixture') return { status: 'ready', mode: 'fixture', entries: fixtureCatalogue };
    if (config.mode === 'snapshot') return { status: 'ready', mode: 'snapshot', entries: await loadCatalogueImages(await readSnapshot(config.path)) };
    const connection = createPgExecutor(config.databaseUrl, process.env.SUPABASE_DB_CA_PEM);
    try {
      await assertDevelopmentDatabase(connection.db, config.projectRef);
      const entries = await readPublishedCatalogue(connection.db);
      return { status: 'ready', mode: 'supabase', entries: await loadCatalogueImages(entries) };
    } finally { await connection.close(); }
  } catch (error) {
    // Never echo provider errors: connection strings and source payloads can appear in them.
    return { status: error instanceof CatalogueSetupError ? 'setup' : 'unavailable', entries: [] };
  }
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
