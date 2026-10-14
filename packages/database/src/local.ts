import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { SqlExecutor } from "./executor.js";

/** Local test shim ONLY; real Supabase owns its auth/storage schema and roles. */
const LOCAL_SUPABASE_SHIM = `
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text not null);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
create table if not exists public.padlownia_local_migrations(name text primary key,sha256 text not null);
`;

export async function openLocalDatabase(directory?: string): Promise<{ db: SqlExecutor; close: () => Promise<void> }> {
  const pg = new PGlite(directory);
  await pg.waitReady;
  try {
    await pg.exec(LOCAL_SUPABASE_SHIM);
    const folder = new URL("../../../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(folder)).filter((x) => x.endsWith(".sql")).sort()) {
      const sql = await readFile(fileURLToPath(new URL(name, folder)), "utf8");
      const sha256 = createHash("sha256").update(sql).digest("hex");
      const applied = await pg.query<{ sha256: string }>("select sha256 from public.padlownia_local_migrations where name=$1", [name]);
      if (applied.rows[0]) {
        if (applied.rows[0].sha256 !== sha256) throw new Error("LOCAL_MIGRATION_CHECKSUM_MISMATCH");
        continue;
      }
      await pg.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into public.padlownia_local_migrations(name,sha256) values($1,$2)", [name,sha256]);
      });
    }
    await pg.query("insert into padlownia.environment_identity(singleton,environment,project_ref) values(true,'development','local') on conflict(singleton) do nothing");
  } catch (error) {
    await pg.close();
    throw error;
  }
  const db: SqlExecutor = {
    query: async <T>(sql: string, params: unknown[] = []) => ({ rows: (await pg.query<T>(sql, params)).rows }),
    transaction: async (work) => pg.transaction(async (tx) => {
      const executor: SqlExecutor = {
        query: async <T>(sql: string, params: unknown[] = []) => ({ rows: (await tx.query<T>(sql,params)).rows }),
        transaction: async (nested) => nested(executor),
      };
      return work(executor);
    }),
  };
  return { db, close: () => pg.close() };
}
