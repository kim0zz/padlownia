import { Pool, type PoolClient, type PoolConfig } from "pg";

export interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

function clientExecutor(client: PoolClient): SqlExecutor {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[] };
    },
    transaction: async (work) => work(clientExecutor(client)),
  };
}

/** Parse once into explicit fields: pg must never reinterpret host/user/SSL URL options. */
export function postgresConnectionConfig(connectionString: string, trustedCaPem?: string): PoolConfig {
  try {
    const target = new URL(connectionString);
    if (!["postgres:","postgresql:"].includes(target.protocol) || !target.hostname || !target.username || !target.password || target.hash) throw new Error();
    const options = [...target.searchParams.entries()];
    if (options.some(([key,value]) => key !== "sslmode" || value !== "verify-full") || options.length > 1) throw new Error();
    const port = target.port ? Number(target.port) : 5432;
    const database = decodeURIComponent(target.pathname.slice(1));
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !database || database.includes("/") || [...database].some((c) => c.charCodeAt(0) < 32)) throw new Error();
    return {
      host: target.hostname,port,user: decodeURIComponent(target.username),password: decodeURIComponent(target.password),database,
      ssl: { rejectUnauthorized: true, ...(trustedCaPem ? { ca: trustedCaPem } : {}) },max: 3,connectionTimeoutMillis: 10_000,statement_timeout: 30_000,
    };
  } catch { throw new Error("INVALID_DATABASE_CONNECTION_CONFIG"); }
}

/** Server/worker only. Never import this module from a browser component. */
export function createPgExecutor(connectionString: string, trustedCaPem?: string): { db: SqlExecutor; close: () => Promise<void> } {
  const pool = new Pool(postgresConnectionConfig(connectionString, trustedCaPem));
  // An idle client dropped by the server emits 'error' on the pool; unhandled, it kills the process.
  // The pool discards that client and the next query opens a new one. Never log it: it can carry connection details.
  pool.on("error", () => {});
  const db: SqlExecutor = {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(work: (tx: SqlExecutor) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await work(clientExecutor(client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally { client.release(); }
    },
  };
  return { db, close: () => pool.end() };
}

type SharedExecutors = Map<string, { db: SqlExecutor; close: () => Promise<void> }>;
const shared = ((globalThis as { __padlowniaPgExecutors?: SharedExecutors }).__padlowniaPgExecutors ??= new Map());

/**
 * One long-lived pool per connection target for request-serving code (web): avoids a new TLS handshake
 * and pool per request. Kept on globalThis so dev hot reload does not leak pools. Never call close() on it.
 */
export function sharedPgExecutor(connectionString: string, trustedCaPem?: string): SqlExecutor {
  const key = `${connectionString}\n${trustedCaPem ?? ""}`;
  let executor = shared.get(key);
  if (!executor) { executor = createPgExecutor(connectionString, trustedCaPem); shared.set(key, executor); }
  return executor.db;
}

/** Verify a DB-owned immutable marker in addition to the caller's URL/ref checks. */
export async function assertDevelopmentDatabase(db: SqlExecutor, expectedRef: string): Promise<void> {
  if (expectedRef !== "local" && !/^[a-z0-9]{20}$/.test(expectedRef)) throw new Error("INVALID_DEVELOPMENT_PROJECT_REF");
  let rows: { environment: string; project_ref: string }[];
  try {
    ({ rows } = await db.query<{ environment: string; project_ref: string }>("select environment,project_ref from padlownia.environment_identity where singleton"));
  } catch { throw new Error("DATABASE_IDENTITY_UNAVAILABLE"); }
  if (rows.length !== 1 || rows[0]!.environment !== "development" || rows[0]!.project_ref !== expectedRef) throw new Error("DATABASE_IDENTITY_MISMATCH");
}
