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
