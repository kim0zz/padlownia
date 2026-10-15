import 'server-only';
import { assertDevelopmentDatabase, createPgExecutor } from '@padlownia/database/executor';
import { readPublishedCatalogue, type CatalogueEntry } from '@padlownia/database/catalogue';
import { fixtureCatalogue } from './fixtures';
import { CatalogueSetupError, resolveCatalogueConfig } from './config';
import { loadCatalogueImages } from './catalogue-images-server';

export type CatalogueResult =
  | { status: 'ready'; mode: 'fixture' | 'supabase'; entries: CatalogueEntry[] }
  | { status: 'setup' | 'unavailable'; entries: [] };

export async function getCatalogue(): Promise<CatalogueResult> {
  try {
    const config = resolveCatalogueConfig(process.env);
    if (config.mode === 'fixture') return { status: 'ready', mode: 'fixture', entries: fixtureCatalogue };
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
