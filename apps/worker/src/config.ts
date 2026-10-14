export class WorkerError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'WorkerError'; }
}
export type DevConfig = { projectRef: string; apiUrl: string; databaseUrl: string; storageKey?: string };

/** Explicit, environment-specific opt-in. Never accept an arbitrary host or privileged postgres login. */
export function devConfig(env: Record<string, string | undefined>): DevConfig {
  const ref = env.DEV_SUPABASE_PROJECT_REF;
  if (env.APP_ENV !== 'development' || env.DEV_SUPABASE_CONFIRMED !== 'true' || !ref || !/^[a-z0-9]{20}$/.test(ref)) throw new WorkerError('DEV_PROJECT_NOT_CONFIRMED');
  if (env.SUPABASE_URL !== `https://${ref}.supabase.co`) throw new WorkerError('DEV_PROJECT_URL_MISMATCH');
  try {
    const url = new URL(env.DEV_DATABASE_URL ?? '');
    const user = decodeURIComponent(url.username);
    const direct = url.hostname === `db.${ref}.supabase.co` && user === 'padlownia_ingest';
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && user === `padlownia_ingest.${ref}`;
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !(direct || pooler) || !url.password || url.pathname !== '/postgres') throw new Error();
    if (url.hash || [...url.searchParams.keys()].some((key) => key !== 'sslmode') || url.searchParams.getAll('sslmode').length !== 1 || url.searchParams.get('sslmode') !== 'verify-full') throw new Error();
    if (url.port && !['5432', '6543'].includes(url.port)) throw new Error();
    return { projectRef: ref, apiUrl: env.SUPABASE_URL, databaseUrl: env.DEV_DATABASE_URL!, storageKey: env.SUPABASE_STORAGE_KEY };
  } catch { throw new WorkerError('DEV_DATABASE_URL_INVALID'); }
}

/** Never echo driver/provider messages, paths, raw payloads, URLs or credentials. */
export function safeError(error: unknown): string {
  return error instanceof WorkerError ? error.code : 'OPERATION_FAILED';
}
