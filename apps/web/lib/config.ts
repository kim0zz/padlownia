export type CatalogueConfig = { mode: 'fixture' } | { mode: 'snapshot'; path: string } | { mode: 'supabase'; databaseUrl: string; projectRef: string };
export class CatalogueSetupError extends Error {
  constructor() { super('CATALOGUE_SETUP_REQUIRED'); }
}

/** Credentials never leave server code. Validate both the intended dev environment and project identity. */
export function resolveCatalogueConfig(env: Record<string, string | undefined>): CatalogueConfig {
  if (env.CATALOGUE_MODE === 'fixture') return { mode: 'fixture' };
  // Local export of the published Dev catalogue (e.g. .local/catalogue-export.json); development only.
  if (env.CATALOGUE_MODE === 'snapshot') {
    if (env.APP_ENV !== 'development' || !env.CATALOGUE_SNAPSHOT_PATH?.trim()) throw new CatalogueSetupError();
    return { mode: 'snapshot', path: env.CATALOGUE_SNAPSHOT_PATH.trim() };
  }
  if (env.CATALOGUE_MODE !== 'supabase' || env.APP_ENV !== 'development') throw new CatalogueSetupError();
  const projectRef = env.DEV_SUPABASE_PROJECT_REF;
  if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef) || !env.WEB_DATABASE_URL) throw new CatalogueSetupError();
  try {
    const url = new URL(env.WEB_DATABASE_URL);
    const username = decodeURIComponent(url.username);
    const direct = url.hostname === `db.${projectRef}.supabase.co` && username === 'padlownia_web';
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && username === `padlownia_web.${projectRef}`;
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !(direct || pooler) || !url.password || url.pathname !== '/postgres') throw new CatalogueSetupError();
    // pg permits query parameters to override the authority user/host. Reject
    // every override, duplicate option and TLS downgrade before opening a socket.
    if ([...url.searchParams].length !== 1 || url.searchParams.get('sslmode') !== 'verify-full') throw new CatalogueSetupError();
    return { mode: 'supabase', databaseUrl: env.WEB_DATABASE_URL, projectRef };
  } catch { throw new CatalogueSetupError(); }
}
