import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { devConfig, safeError, WorkerError } from '../../apps/worker/src/config.js';
import { LocalSnapshotStore, boundedFetch, SupabaseSnapshotStore } from '../../apps/worker/src/storage.js';

const ref = 'abcdefghijklmnopqrst';
const env = { APP_ENV: 'development', DEV_SUPABASE_CONFIRMED: 'true', DEV_SUPABASE_PROJECT_REF: ref, SUPABASE_URL: `https://${ref}.supabase.co`, DEV_DATABASE_URL: `postgresql://padlownia_ingest:example@db.${ref}.supabase.co/postgres?sslmode=verify-full` };
describe('ING-023/032 development target and secret boundary', () => {
  it('requires explicit dev identity and exact endpoint', () => {
    expect(devConfig(env).projectRef).toBe(ref);
    for (const changed of [{ APP_ENV: 'production' }, { DEV_SUPABASE_CONFIRMED: undefined }, { SUPABASE_URL: 'https://other.supabase.co' }, { DEV_DATABASE_URL: 'postgres://postgres:example@localhost/postgres' }, { DEV_DATABASE_URL: env.DEV_DATABASE_URL.replace('verify-full', 'disable') }]) expect(() => devConfig({ ...env, ...changed })).toThrow();
  });
  it('never returns underlying secret-bearing errors', () => {
    expect(safeError(new Error('password=do-not-print'))).toBe('OPERATION_FAILED');
    expect(safeError(new WorkerError('STORAGE_ACCESS_DENIED'))).toBe('STORAGE_ACCESS_DENIED');
  });
  it('rejects query-string connection overrides and duplicate TLS settings', () => {
    for (const suffix of ['&host=other.example', '&user=postgres', '&sslmode=disable', '&port=9999', '&sslrootcert=secret-file']) expect(() => devConfig({ ...env, DEV_DATABASE_URL: env.DEV_DATABASE_URL + suffix })).toThrow('DEV_DATABASE_URL_INVALID');
    expect(() => devConfig({ ...env, DEV_DATABASE_URL: env.DEV_DATABASE_URL.replace('?sslmode=verify-full', '') })).toThrow('DEV_DATABASE_URL_INVALID');
  });
  it('accepts the Supabase pooler shape only for the scoped ingest login', () => {
    const databaseUrl = `postgresql://padlownia_ingest.${ref}:example@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=verify-full`;
    expect(devConfig({ ...env, DEV_DATABASE_URL: databaseUrl }).databaseUrl).toBe(databaseUrl);
    expect(() => devConfig({ ...env, DEV_DATABASE_URL: databaseUrl.replace('padlownia_ingest.', 'postgres.') })).toThrow();
  });
});
describe('ING-018/019 snapshot storage', () => {
  it('reuses immutable bytes and detects an existing corrupted object', async () => {
    const root = await mkdtemp(join(tmpdir(), 'padlownia-storage-'));
    try {
      const store = new LocalSnapshotStore(root), bytes = Buffer.from('{"synthetic":true}');
      const first = await store.put('padelhow', bytes);
      expect(await store.put('padelhow', bytes)).toEqual(first);
      const file = join(root, first.bucket, first.path);
      expect(await readFile(file)).toEqual(bytes);
      await writeFile(file, 'corrupt');
      await expect(store.put('padelhow', bytes)).rejects.toThrow('STORAGE_HASH_MISMATCH');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('bounds transient retries and does not retry denied requests', async () => {
    const denied = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 }));
    expect((await boundedFetch('https://example.invalid', {}, denied)).status).toBe(403);
    expect(denied).toHaveBeenCalledTimes(1);
    const unavailable = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status: 503 }));
    await expect(boundedFetch('https://example.invalid', {}, unavailable)).rejects.toThrow('STORAGE_UNAVAILABLE');
    expect(unavailable).toHaveBeenCalledTimes(3);
  });
  it('refuses writes to a public bucket', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"public":true}'));
    const store = new SupabaseSnapshotStore({ ...devConfig(env), storageKey: 'synthetic-test-value' }, request);
    await expect(store.put('padeltrue', Buffer.from('{}'))).rejects.toThrow('STORAGE_BUCKET_NOT_PRIVATE');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
