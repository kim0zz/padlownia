import { describe, expect, it } from 'vitest';
import { catalogueUrl, claimLabel, filterCatalogue, formatWeight, methodologyCitation, parseFilters, rawText, safeSourceUrl } from '../../apps/web/lib/catalogue';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import { resolveCatalogueConfig } from '../../apps/web/lib/config';

describe('classic catalogue search and provenance presentation', () => {
  it('keeps exact years and variants separate', () => {
    const entries = filterCatalogue(fixtureCatalogue, parseFilters({ q: 'orbit control', year: '2026' }));
    expect(entries.map((entry) => entry.id)).toEqual(['fixture-orbit-control-2026']);
    expect(filterCatalogue(fixtureCatalogue, parseFilters({ q: 'orbit' }))).toHaveLength(3);
  });
  it('supports explicit unknown year, filters, no results and shareable search state', () => {
    expect(filterCatalogue(fixtureCatalogue, parseFilters({ year: 'unknown' }))[0]?.model).toBe('Arc');
    expect(filterCatalogue(fixtureCatalogue, parseFilters({ shape: 'diamond' }))[0]?.variant).toBe('Attack');
    expect(filterCatalogue(fixtureCatalogue, parseFilters({ brand: 'missing' }))).toEqual([]);
    expect(catalogueUrl(parseFilters({ q: 'Pro +', year: '2026' }), 2)).toBe('/?q=Pro+%2B&year=2026&page=2');
  });
  it('bounds untrusted query inputs', () => {
    expect(parseFilters({ q: ['a'.repeat(1000), 'ignored'], page: '-42' })).toMatchObject({ q: 'a'.repeat(120), page: 1 });
    expect(parseFilters({ page: '1000000' }).page).toBe(10000);
  });
  it('does not invent missing values or discard numeric zero', () => {
    expect(formatWeight(null, null)).toBe('Brak danych');
    expect(formatWeight(360, 370)).toBe('360–370 g');
    expect(formatWeight(null, 370)).toBe('Do 370 g');
    expect(rawText(0)).toBe('0');
    expect(rawText({ value: '365 g' })).toBe('{"value":"365 g"}');
  });
  it('labels unverified manufacturer attribution explicitly', () => {
    const spec = structuredClone(fixtureCatalogue[0]!.specs[0]!);
    expect(claimLabel(spec)).toBe('Deklaracja producenta');
    spec.evidence.attribution!.verified = false;
    expect(claimLabel(spec)).toContain('niezweryfikowane');
  });
  it('rejects executable source links and never links fake example domains', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/x', 'https://example.invalid/x', 'not a URL']) expect(safeSourceUrl(url)).toBeNull();
    expect(safeSourceUrl('https://padel.how/rackets/test')).toBe('https://padel.how/rackets/test');
  });
  it('keeps methodology caveats visible without making untrusted protocols clickable', () => {
    const note = 'Model uses a neutral default for missing balance.\nValue is unavailable in this currency.';
    expect(methodologyCitation(`https://padeltrue.com/methodology\n${note}`)).toEqual({ url: 'https://padeltrue.com/methodology', note });
    expect(methodologyCitation('https://padel.how/equipment/racket/methodology/')).toEqual({ url: 'https://padel.how/equipment/racket/methodology/', note: '' });
    for (const raw of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/methodology', 'https://example.invalid/methodology', 'Synthetic methodology']) {
      expect(methodologyCitation(raw)).toEqual({ url: null, note: raw });
    }
    expect(methodologyCitation('')).toEqual({ url: null, note: '' });
  });
});

const projectRef = 'abcdefghijklmnopqrst';
const valid = { CATALOGUE_MODE: 'supabase', APP_ENV: 'development', DEV_SUPABASE_PROJECT_REF: projectRef,
  WEB_DATABASE_URL: `postgresql://padlownia_web:synthetic-password@db.${projectRef}.supabase.co:5432/postgres?sslmode=verify-full` };

describe('catalogue environment safeguards', () => {
  it('requires explicit fixture mode and never silently falls back', () => {
    expect(resolveCatalogueConfig({ CATALOGUE_MODE: 'fixture' })).toEqual({ mode: 'fixture' });
    expect(() => resolveCatalogueConfig({})).toThrow('CATALOGUE_SETUP_REQUIRED');
    expect(() => resolveCatalogueConfig({ ...valid, APP_ENV: 'production' })).toThrow();
  });
  it('accepts only the identified project and dedicated least-privilege login', () => {
    expect(resolveCatalogueConfig(valid).mode).toBe('supabase');
    expect(() => resolveCatalogueConfig({ ...valid, WEB_DATABASE_URL: valid.WEB_DATABASE_URL.replace('padlownia_web:', 'postgres:') })).toThrow();
    expect(() => resolveCatalogueConfig({ ...valid, DEV_SUPABASE_PROJECT_REF: 'anotherprojectrefxxxx' })).toThrow();
    expect(resolveCatalogueConfig({ ...valid, WEB_DATABASE_URL: `postgresql://padlownia_web.${projectRef}:synthetic-password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=verify-full` }).mode).toBe('supabase');
  });
  it('rejects pg query-parameter overrides, duplicated TLS options and downgrades', () => {
    for (const tail of ['&host=other.example', '&user=postgres', '&sslmode=disable', '&password=other']) expect(() => resolveCatalogueConfig({ ...valid, WEB_DATABASE_URL: valid.WEB_DATABASE_URL + tail })).toThrow();
    for (const ssl of ['', '?sslmode=require', '?sslmode=verify-ca', '?sslmode=disable']) expect(() => resolveCatalogueConfig({ ...valid, WEB_DATABASE_URL: valid.WEB_DATABASE_URL.split('?')[0] + ssl })).toThrow();
  });
  it('does not leak credential-bearing invalid inputs in errors', () => {
    try { resolveCatalogueConfig({ ...valid, WEB_DATABASE_URL: 'invalid://sensitive-placeholder' }); } catch (error) { expect(String(error)).not.toContain('sensitive-placeholder'); }
  });
});
