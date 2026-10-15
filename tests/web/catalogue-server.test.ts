import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const stubs = vi.hoisted(() => ({ read: vi.fn(), close: vi.fn(), create: vi.fn(), identity: vi.fn() }));
vi.mock('@padlownia/database/executor', () => ({ createPgExecutor: stubs.create, assertDevelopmentDatabase: stubs.identity }));
vi.mock('@padlownia/database/catalogue', () => ({ readPublishedCatalogue: stubs.read }));
import { getCatalogue } from '../../apps/web/lib/catalogue-server';

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe('server catalogue isolation', () => {
  it('shows fixtures only in explicitly selected fixture mode', async () => {
    vi.stubEnv('CATALOGUE_MODE', 'fixture');
    const result = await getCatalogue();
    expect(result.status).toBe('ready');
    expect(result.entries).toHaveLength(6);
    expect(stubs.create).not.toHaveBeenCalled();
  });
  it('returns safe setup state when config is absent', async () => {
    vi.stubEnv('CATALOGUE_MODE', '');
    expect(await getCatalogue()).toEqual({ status: 'setup', entries: [] });
  });
  it('fails closed on DB errors, closes connection and does not expose secrets', async () => {
    vi.stubEnv('CATALOGUE_MODE', 'supabase'); vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('DEV_SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubEnv('WEB_DATABASE_URL', 'postgresql://padlownia_web:synthetic-secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=verify-full');
    stubs.create.mockReturnValue({ db: {}, close: stubs.close });
    stubs.read.mockRejectedValue(new Error('credential synthetic-secret connection failed'));
    const result = await getCatalogue();
    expect(result).toEqual({ status: 'unavailable', entries: [] });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');
    expect(stubs.close).toHaveBeenCalledOnce();
  });
  it('keeps an empty published release empty', async () => {
    vi.stubEnv('CATALOGUE_MODE', 'supabase'); vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('DEV_SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubEnv('WEB_DATABASE_URL', 'postgresql://padlownia_web:synthetic-secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=verify-full');
    stubs.create.mockReturnValue({ db: {}, close: stubs.close }); stubs.read.mockResolvedValue([]);
    expect(await getCatalogue()).toEqual({ status: 'ready', mode: 'supabase', entries: [] });
    expect(stubs.identity).toHaveBeenCalledWith({}, 'abcdefghijklmnopqrst');
  });
  it('never reads catalogue data if the database identity is unverified', async () => {
    vi.stubEnv('CATALOGUE_MODE', 'supabase'); vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('DEV_SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubEnv('WEB_DATABASE_URL', 'postgresql://padlownia_web:synthetic-secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=verify-full');
    stubs.create.mockReturnValue({ db: {}, close: stubs.close });
    stubs.identity.mockRejectedValue(new Error('DATABASE_IDENTITY_MISMATCH'));
    expect(await getCatalogue()).toEqual({ status: 'unavailable', entries: [] });
    expect(stubs.read).not.toHaveBeenCalled();
    expect(stubs.close).toHaveBeenCalledOnce();
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
    expect(stubs.create).not.toHaveBeenCalled();
    vi.stubEnv('APP_ENV', 'production');
    expect(await getCatalogue()).toEqual({ status: 'setup', entries: [] });
    vi.stubEnv('APP_ENV', 'development'); vi.stubEnv('CATALOGUE_SNAPSHOT_PATH', '');
    expect(await getCatalogue()).toEqual({ status: 'setup', entries: [] });
  });
  it('rejects malformed, duplicated or mixed-release exports', async () => {
    const { parseCatalogueSnapshot } = await import('../../apps/web/lib/catalogue-server');
    expect(parseCatalogueSnapshot(JSON.stringify([entry('a')]))).toHaveLength(1);
    for (const bad of ['{}', '[1]', JSON.stringify([entry('a'), entry('a')]), JSON.stringify([entry('a'), entry('b', 'release-b')]), JSON.stringify([{ ...entry('a'), specs: null }])]) {
      expect(() => parseCatalogueSnapshot(bad)).toThrow();
    }
  });
  it('a missing snapshot file is an unavailable state, not fixtures', async () => {
    vi.stubEnv('CATALOGUE_MODE', 'snapshot'); vi.stubEnv('APP_ENV', 'development'); vi.stubEnv('CATALOGUE_SNAPSHOT_PATH', '/nonexistent/padlownia.json');
    expect(await getCatalogue()).toEqual({ status: 'unavailable', entries: [] });
  });
});
