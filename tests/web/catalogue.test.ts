import { describe, expect, it } from 'vitest';
import type { CatalogueEntry } from '@padlownia/database';
import { catalogueUrl, claimLabel, filterCatalogue, formatWeight, methodologyCitation, PAGE_SIZE, parseFilters, rawText, safeSourceUrl } from '../../apps/web/lib/catalogue';
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
  it('maps an old brand spelling in a link to the canonical brand', () => {
    expect(parseFilters({ brand: 'STARVIE' }).brand).toBe('StarVie');
    expect(parseFilters({ brand: 'Cork Padel' }).brand).toBe('Cork');
    expect(parseFilters({}).brand).toBe('');
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

// Synthetic entries for filter and sort tests; only the fields these functions read are meaningful.
function synthetic(id: string, over: Partial<CatalogueEntry>): CatalogueEntry {
  return { ...structuredClone(fixtureCatalogue[0]!), id, brand: 'TESTLAB', model: id, variant: '', modelYear: 2026, weightMinG: null, weightMaxG: null, ratings: [], ...over };
}
const rated = (count: number) => Array.from({ length: count }, () => structuredClone(fixtureCatalogue[0]!.ratings[0]!));
const ids = (entries: CatalogueEntry[]) => entries.map((entry) => entry.id);
const run = (entries: CatalogueEntry[], params: Record<string, string>) => ids(filterCatalogue(entries, parseFilters(params)));

describe('catalogue weight filter (overlap of declared range and filter range)', () => {
  const entries = [
    synthetic('light', { weightMinG: 340, weightMaxG: 350 }),
    synthetic('edge-355', { weightMinG: 345, weightMaxG: 355 }),
    synthetic('mid', { weightMinG: 358, weightMaxG: 362 }),
    synthetic('edge-365', { weightMinG: 365, weightMaxG: 365 }),
    synthetic('upper', { weightMinG: 368, weightMaxG: 372 }),
    synthetic('edge-375', { weightMinG: 370, weightMaxG: 375 }),
    synthetic('heavy', { weightMinG: 376, weightMaxG: 380 }),
    synthetic('only-max', { weightMinG: null, weightMaxG: 372 }),
    synthetic('no-weight', {}),
  ];
  it('lt355 includes ranges that touch the range below 355 g', () => {
    expect(run(entries, { weight: 'lt355', sort: 'name' }).sort()).toEqual(['edge-355', 'light']);
  });
  it('355-365 includes both boundaries and any overlapping range', () => {
    expect(run(entries, { weight: '355-365' }).sort()).toEqual(['edge-355', 'edge-365', 'mid']);
  });
  it('365-375 includes both boundaries; a range with one known bound counts as that point', () => {
    expect(run(entries, { weight: '365-375' }).sort()).toEqual(['edge-365', 'edge-375', 'only-max', 'upper']);
  });
  it('gt375 starts above 375 g, so a range ending exactly at 375 g does not qualify', () => {
    expect(run(entries, { weight: 'gt375' })).toEqual(['heavy']);
  });
  it('never matches a racket without weight, and is a no-op when unset', () => {
    for (const weight of ['lt355', '355-365', '365-375', 'gt375']) expect(run(entries, { weight })).not.toContain('no-weight');
    expect(run(entries, {})).toHaveLength(entries.length);
  });
  it('combines with shape and year (U2: light diamond rackets from 2026)', () => {
    const mixed = [
      synthetic('a', { shape: 'diamond', modelYear: 2026, weightMinG: 350, weightMaxG: 355 }),
      synthetic('b', { shape: 'round', modelYear: 2026, weightMinG: 350, weightMaxG: 355 }),
      synthetic('c', { shape: 'diamond', modelYear: 2025, weightMinG: 350, weightMaxG: 355 }),
      synthetic('d', { shape: 'diamond', modelYear: 2026, weightMinG: 370, weightMaxG: 375 }),
    ];
    expect(run(mixed, { weight: 'lt355', shape: 'diamond', year: '2026' })).toEqual(['a']);
  });
});

describe('catalogue rated filter', () => {
  const entries = [synthetic('none', {}), synthetic('one', { ratings: rated(1) }), synthetic('two', { ratings: rated(2) })];
  it('keeps only rackets with at least one rating when rated=1', () => {
    expect(run(entries, { rated: '1', sort: 'name' })).toEqual(['one', 'two']);
  });
  it('ignores any other value', () => {
    for (const rated of ['0', 'true', '', '11']) expect(run(entries, { rated })).toHaveLength(3);
  });
});

describe('catalogue sorting', () => {
  it('defaults to newest: year descending, unknown year last, then brand, model and id', () => {
    const entries = [
      synthetic('z-unknown', { modelYear: null }), synthetic('b-2025', { modelYear: 2025, model: 'B' }), synthetic('a-2026', { modelYear: 2026, model: 'A' }),
      synthetic('c-2026-nox', { modelYear: 2026, brand: 'NOX', model: 'C' }), synthetic('a-2026-b', { modelYear: 2026, model: 'A' }),
    ];
    expect(run(entries, {})).toEqual(['c-2026-nox', 'a-2026', 'a-2026-b', 'b-2025', 'z-unknown']);
    expect(run(entries, { sort: 'newest' })).toEqual(run(entries, {}));
  });
  it('name: brand, model, year descending, id', () => {
    const entries = [synthetic('2', { brand: 'NOX', model: 'Zed' }), synthetic('3', { model: 'Alfa', modelYear: 2025 }), synthetic('4', { model: 'Alfa', modelYear: 2026 }), synthetic('1', { brand: 'Adidas', model: 'Zeta' })];
    expect(run(entries, { sort: 'name' })).toEqual(['1', '2', '4', '3']);
  });
  it('weight: range midpoint ascending, unknown last, ties by name', () => {
    const entries = [
      synthetic('unknown', {}), synthetic('heavy', { weightMinG: 370, weightMaxG: 380 }),
      synthetic('b-same', { model: 'B', weightMinG: 360, weightMaxG: 360 }), synthetic('a-same', { model: 'A', weightMinG: 355, weightMaxG: 365 }),
      synthetic('light', { weightMinG: 340, weightMaxG: 350 }),
    ];
    expect(run(entries, { sort: 'weight' })).toEqual(['light', 'a-same', 'b-same', 'heavy', 'unknown']);
  });
  it('ratings: number of ratings descending, then name', () => {
    const entries = [synthetic('b-none', { model: 'B' }), synthetic('two', { ratings: rated(2), model: 'Z' }), synthetic('a-none', { model: 'A' }), synthetic('one', { ratings: rated(1) })];
    expect(run(entries, { sort: 'ratings' })).toEqual(['two', 'one', 'a-none', 'b-none']);
  });
  it('does not mutate the input array', () => {
    const entries = [synthetic('b', { model: 'B' }), synthetic('a', { model: 'A' })];
    run(entries, { sort: 'name' });
    expect(ids(entries)).toEqual(['b', 'a']);
  });
});

describe('catalogue filter parsing and URLs', () => {
  it('falls back to defaults for values outside the allowed lists', () => {
    expect(parseFilters({ weight: '999', rated: 'yes', sort: 'price' })).toMatchObject({ weight: '', rated: '', sort: 'newest' });
    expect(parseFilters({ weight: ['gt375', 'lt355'], sort: ['ratings'] })).toMatchObject({ weight: 'gt375', sort: 'ratings' });
    expect(parseFilters({})).toMatchObject({ weight: '', rated: '', sort: 'newest', page: 1 });
  });
  it('omits defaults from the URL and keeps every active filter', () => {
    expect(catalogueUrl(parseFilters({}))).toBe('/');
    expect(catalogueUrl(parseFilters({ sort: 'newest', weight: 'bad' }))).toBe('/');
    expect(catalogueUrl(parseFilters({ q: 'nox', weight: '355-365', rated: '1', sort: 'weight' }), 3)).toBe('/?q=nox&weight=355-365&rated=1&sort=weight&page=3');
  });
  it('pages 24 results at a time', () => {
    expect(PAGE_SIZE).toBe(24);
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
