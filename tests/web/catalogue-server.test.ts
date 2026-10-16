import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { getCatalogue as GetCatalogue } from '../../apps/web/lib/catalogue-server';

vi.mock('server-only', () => ({}));
const stubs = vi.hoisted(() => ({ read: vi.fn(), shared: vi.fn(), identity: vi.fn() }));
vi.mock('@padlownia/database/executor', () => ({ sharedPgExecutor: stubs.shared, assertDevelopmentDatabase: stubs.identity }));
vi.mock('@padlownia/database/catalogue', async (importOriginal) => ({ ...(await importOriginal<object>()), readPublishedCatalogue: stubs.read }));
// The catalogue cache is module state: every test gets a fresh module.
let getCatalogue: typeof GetCatalogue;
beforeEach(async () => { vi.resetModules(); ({ getCatalogue } = await import('../../apps/web/lib/catalogue-server')); });

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); vi.useRealTimers(); });
const stubSupabase = () => {
  vi.stubEnv('CATALOGUE_MODE', 'supabase'); vi.stubEnv('APP_ENV', 'development');
  vi.stubEnv('DEV_SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
  vi.stubEnv('WEB_DATABASE_URL', 'postgresql://padlownia_web:synthetic-secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=verify-full');
  stubs.shared.mockReturnValue({});
};
const racket = (id: string) => ({ id, releaseId: 'release-a', brand: 'TESTLAB', model: id, variant: '', modelYear: 2026, shape: null, weightMinG: null, weightMaxG: null, balanceCm: null, core: null, surface: null, specs: [], ratings: [] });

describe('server catalogue isolation', () => {
  it('shows fixtures only in explicitly selected fixture mode', async () => {
    vi.stubEnv('CATALOGUE_MODE', 'fixture');
    const result = await getCatalogue();
    expect(result.status).toBe('ready');
    expect(result.entries).toHaveLength(6);
    expect(stubs.shared).not.toHaveBeenCalled();
  });
  it('returns safe setup state when config is absent', async () => {
    vi.stubEnv('CATALOGUE_MODE', '');
    expect(await getCatalogue()).toEqual({ status: 'setup', entries: [] });
  });
  it('fails closed on DB errors and does not expose secrets', async () => {
    stubSupabase();
    stubs.read.mockRejectedValue(new Error('credential synthetic-secret connection failed'));
    const result = await getCatalogue();
    expect(result).toEqual({ status: 'unavailable', entries: [] });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');
  });
  it('keeps an empty published release empty', async () => {
    stubSupabase(); stubs.read.mockResolvedValue([]);
    expect(await getCatalogue()).toEqual({ status: 'ready', mode: 'supabase', entries: [] });
    expect(stubs.identity).toHaveBeenCalledWith({}, 'abcdefghijklmnopqrst');
  });
  it('never reads catalogue data if the database identity is unverified, and re-checks on the next request', async () => {
    stubSupabase();
    stubs.identity.mockRejectedValue(new Error('DATABASE_IDENTITY_MISMATCH'));
    expect(await getCatalogue()).toEqual({ status: 'unavailable', entries: [] });
    expect(await getCatalogue()).toEqual({ status: 'unavailable', entries: [] });
    expect(stubs.read).not.toHaveBeenCalled();
    expect(stubs.identity).toHaveBeenCalledTimes(2);
  });
});

describe('supabase catalogue cache', () => {
  it('reuses the shared pool and verifies identity once while the copy is fresh', async () => {
    stubSupabase(); stubs.read.mockResolvedValue([racket('a')]);
    for (let i = 0; i < 3; i += 1) expect((await getCatalogue()).entries.map((item) => item.id)).toEqual(['a']);
    expect(stubs.read).toHaveBeenCalledOnce();
    expect(stubs.identity).toHaveBeenCalledOnce();
  });
  it('shares one database read between concurrent requests', async () => {
    stubSupabase(); stubs.read.mockResolvedValue([racket('a')]);
    const results = await Promise.all([getCatalogue(), getCatalogue(), getCatalogue()]);
    expect(results.every((result) => result.status === 'ready')).toBe(true);
    expect(stubs.read).toHaveBeenCalledOnce();
  });
  it('does not cache failures', async () => {
    stubSupabase(); stubs.read.mockRejectedValueOnce(new Error('DATABASE_READ_FAILED')).mockResolvedValue([racket('a')]);
    expect(await getCatalogue()).toEqual({ status: 'unavailable', entries: [] });
    expect((await getCatalogue()).status).toBe('ready');
  });
  it('serves the cached copy while refreshing after the TTL, and waits for fresh data once too stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubSupabase(); stubs.read.mockResolvedValueOnce([racket('a')]).mockResolvedValueOnce([racket('b')]).mockResolvedValue([racket('c')]);
    expect((await getCatalogue()).entries.map((item) => item.id)).toEqual(['a']);
    vi.setSystemTime(Date.now() + 61_000);
    expect((await getCatalogue()).entries.map((item) => item.id)).toEqual(['a']);
    await vi.waitFor(() => expect(stubs.read).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect((await getCatalogue()).entries.map((item) => item.id)).toEqual(['b']);
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect((await getCatalogue()).entries.map((item) => item.id)).toEqual(['c']);
    expect(stubs.identity).toHaveBeenCalledOnce();
  });
  it('drops to unavailable when the copy is too stale and the database is down', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubSupabase(); stubs.read.mockResolvedValueOnce([racket('a')]).mockRejectedValue(new Error('DATABASE_READ_FAILED'));
    expect((await getCatalogue()).status).toBe('ready');
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect(await getCatalogue()).toEqual({ status: 'unavailable', entries: [] });
  });
});

describe('local snapshot mode', () => {
  const entry = (id: string, releaseId = 'release-a') => ({ id, releaseId, brand: 'TESTLAB', model: 'Orbit', variant: '', modelYear: 2026, shape: null, weightMinG: null, weightMaxG: null, balanceCm: null, core: null, surface: null, specs: [], ratings: [] });
  it('reads a local export only in development with an explicit path', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const path = join(mkdtempSync(join(tmpdir(), 'padlownia-snapshot-')), 'catalogue.json');
    writeFileSync(path, JSON.stringify([entry('a'), entry('b')]));
    vi.stubEnv('CATALOGUE_MODE', 'snapshot'); vi.stubEnv('APP_ENV', 'development'); vi.stubEnv('CATALOGUE_SNAPSHOT_PATH', path);
    const result = await getCatalogue();
    expect(result.status).toBe('ready');
    expect(result.status === 'ready' && result.mode).toBe('snapshot');
    expect(result.entries.map((item) => item.id)).toEqual(['a', 'b']);
    expect(stubs.shared).not.toHaveBeenCalled();
    vi.stubEnv('APP_ENV', 'production');
    expect(await getCatalogue()).toEqual({ status: 'setup', entries: [] });
    vi.stubEnv('APP_ENV', 'development'); vi.stubEnv('CATALOGUE_SNAPSHOT_PATH', '');
    expect(await getCatalogue()).toEqual({ status: 'setup', entries: [] });
  });
  it('rejects malformed, duplicated or mixed-release exports', async () => {
    const { parseCatalogueSnapshot } = await import('../../apps/web/lib/catalogue-server');
    expect(parseCatalogueSnapshot(JSON.stringify([entry('a')]))).toHaveLength(1);
    expect(parseCatalogueSnapshot(JSON.stringify([{ ...entry('a'), brand: 'Cork Padel' }, { ...entry('b'), brand: 'STARVIE' }])).map((x) => x.brand)).toEqual(['Cork', 'StarVie']);
    for (const bad of ['{}', '[1]', JSON.stringify([entry('a'), entry('a')]), JSON.stringify([entry('a'), entry('b', 'release-b')]), JSON.stringify([{ ...entry('a'), specs: null }])]) {
      expect(() => parseCatalogueSnapshot(bad)).toThrow();
    }
  });
  it('a missing snapshot file is an unavailable state, not fixtures', async () => {
    vi.stubEnv('CATALOGUE_MODE', 'snapshot'); vi.stubEnv('APP_ENV', 'development'); vi.stubEnv('CATALOGUE_SNAPSHOT_PATH', '/nonexistent/padlownia.json');
    expect(await getCatalogue()).toEqual({ status: 'unavailable', entries: [] });
  });
});
