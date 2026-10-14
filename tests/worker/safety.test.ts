import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { devConfig, safeError, WorkerError } from '../../apps/worker/src/config.js';
import { LocalSnapshotStore, boundedFetch, SupabaseSnapshotStore, storageAuthHeaders } from '../../apps/worker/src/storage.js';
import { checkDevelopmentStorage } from '../../apps/worker/src/storage-check.js';
import type { SqlExecutor } from '@padlownia/database/executor';

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

describe('development Storage probe', () => {
  const db: SqlExecutor = {
    query: async <T>() => ({ rows: [{ environment: 'development', project_ref: ref }] as T[] }),
    transaction: async (work) => work(db),
  };
  function storageService(exposeAnonymous = false) {
    const objects = new Map<string, Buffer>([['padelhow/unrelated.json', Buffer.from('preserve')]]);
    const request = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const target = String(url);
      const privileged = new Headers(init?.headers).get('apikey') === 'sb_secret_synthetic';
      if (target.includes('/bucket/')) return Response.json({ public: false });
      if (init?.method === 'DELETE') {
        const { prefixes } = JSON.parse(String(init.body)) as { prefixes: string[] };
        expect(prefixes).toHaveLength(1);
        expect(prefixes[0]).toMatch(/^padelhow\/[a-f0-9]{64}\.json$/);
        objects.delete(prefixes[0]!);
        return Response.json([]);
      }
      const path = target.slice(target.indexOf('/source-snapshots/') + '/source-snapshots/'.length);
      if (init?.method === 'POST') {
        if (objects.has(path)) return new Response('', { status: 409 });
        objects.set(path, Buffer.from(init.body as Uint8Array));
        return Response.json({});
      }
      const value = objects.get(path);
      if (!value || (!privileged && !exposeAnonymous)) return new Response('', { status: 400 });
      return new Response(new Uint8Array(value));
    });
    return { objects, request };
  }
  it('checks existing-object anonymous denial and removes only its exact synthetic object', async () => {
    const { objects, request } = storageService();
    const result = await checkDevelopmentStorage({ ...devConfig(env), storageKey: 'sb_secret_synthetic' }, db, 'sb_publishable_synthetic', request);
    expect(result).toMatchObject({ uploadVerified: true, replayVerified: true, anonymousCheck: 'passed', cleanupVerified: true });
    expect([...objects.keys()]).toEqual(['padelhow/unrelated.json']);
  });
  it('fails when raw bytes are accessible without auth and still cleans its object', async () => {
    const { objects, request } = storageService(true);
    await expect(checkDevelopmentStorage({ ...devConfig(env), storageKey: 'sb_secret_synthetic' }, db, undefined, request)).rejects.toThrow('STORAGE_PROBE_ACCESS_NOT_DENIED');
    expect([...objects.keys()]).toEqual(['padelhow/unrelated.json']);
  });
  it('performs no Storage request when the database identity differs', async () => {
    const request = vi.fn<typeof fetch>();
    const wrongDb: SqlExecutor = { ...db, query: async <T>() => ({ rows: [{ environment: 'production', project_ref: ref }] as T[] }) };
    await expect(checkDevelopmentStorage({ ...devConfig(env), storageKey: 'sb_secret_synthetic' }, wrongDb, undefined, request)).rejects.toThrow('DATABASE_IDENTITY_MISMATCH');
    expect(request).not.toHaveBeenCalled();
  });
});
describe('ING-018/019 snapshot storage', () => {
  it('sends opaque secret keys only as apikey and retains legacy JWT authorization', () => {
    expect(storageAuthHeaders('sb_secret_synthetic')).toEqual({ apikey: 'sb_secret_synthetic' });
    expect(storageAuthHeaders('eyJsynthetic.eyJsynthetic.signature')).toEqual({ apikey: 'eyJsynthetic.eyJsynthetic.signature', Authorization: 'Bearer eyJsynthetic.eyJsynthetic.signature' });
    for (const key of ['sb_publishable_synthetic', 'secret value', 'sb_secret_synthetic\nheader']) expect(() => storageAuthHeaders(key)).toThrow('STORAGE_CREDENTIALS_INVALID');
    expect(() => storageAuthHeaders(undefined)).toThrow('STORAGE_CREDENTIALS_MISSING');
  });
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
  it('archives text and JSON originals separately with immutable byte verification', async () => {
    const root = await mkdtemp(join(tmpdir(), 'padlownia-originals-'));
    try {
      const store = new LocalSnapshotStore(root), bytes = Buffer.from('{"synthetic":true}');
      for (const format of ['text', 'json'] as const) {
        const first = await store.putOriginal('padelhow', bytes, format);
        expect(first.bucket).toBe('review-originals');
        expect(first.path.endsWith(format === 'text' ? '.txt' : '.json')).toBe(true);
        expect(await store.putOriginal('padelhow', bytes, format)).toEqual(first);
        const file = join(root, first.bucket, first.path);
        expect(await readFile(file)).toEqual(bytes);
        await writeFile(file, 'corrupt');
        await expect(store.putOriginal('padelhow', bytes, format)).rejects.toThrow('STORAGE_HASH_MISMATCH');
      }
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
    const store = new SupabaseSnapshotStore({ ...devConfig(env), storageKey: 'sb_secret_synthetic' }, request);
    await expect(store.put('padeltrue', Buffer.from('{}'))).rejects.toThrow('STORAGE_BUCKET_NOT_PRIVATE');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('verifies opaque-key uploads and conflict replays without a bearer token or redirects', async () => {
    const bytes = Buffer.from('{"synthetic":true}');
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('apikey')).toBe('sb_secret_synthetic');
      expect(headers.has('Authorization')).toBe(false);
      expect(init?.redirect).toBe('error');
      if (String(_url).includes('/bucket/')) return Response.json({ public: false });
      if (init?.method === 'POST') {
        expect(headers.get('x-upsert')).toBe('false');
        return new Response('', { status: 409 });
      }
      return new Response(bytes);
    });
    const store = new SupabaseSnapshotStore({ ...devConfig(env), storageKey: 'sb_secret_synthetic' }, request);
    expect((await store.put('padelhow', bytes)).verified).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('does not accept a failed upload unless immutable bytes can be read back exactly', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ public: false }))
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockResolvedValueOnce(new Response('different bytes'));
    const store = new SupabaseSnapshotStore({ ...devConfig(env), storageKey: 'sb_secret_synthetic' }, request);
    await expect(store.put('padelhow', Buffer.from('{}'))).rejects.toThrow('STORAGE_HASH_MISMATCH');
  });
  it.each(['text', 'json'] as const)('uses the private original bucket and matching MIME type for %s', async (format) => {
    const bytes = Buffer.from('{"synthetic":true}');
    const request = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      expect(String(url)).toContain('/review-originals');
      if (String(url).includes('/bucket/')) return Response.json({ public: false });
      expect(String(url).endsWith(format === 'text' ? '.txt' : '.json')).toBe(true);
      if (init?.method === 'POST') {
        const headers = new Headers(init.headers);
        expect(headers.get('content-type')).toBe(format === 'text' ? 'text/plain; charset=utf-8' : 'application/json');
        expect(headers.get('x-upsert')).toBe('false');
        return new Response('', { status: 200 });
      }
      return new Response(bytes);
    });
    const store = new SupabaseSnapshotStore({ ...devConfig(env), storageKey: 'sb_secret_synthetic' }, request);
    expect((await store.putOriginal('padelhow', bytes, format)).verified).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
