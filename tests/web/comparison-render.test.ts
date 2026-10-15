import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueEntry } from '@padlownia/database';

const stubs = vi.hoisted(() => ({ catalogue: vi.fn() }));
vi.mock('../../apps/web/lib/catalogue-server', () => ({ getCatalogue: stubs.catalogue }));
// server-only cannot load under Vitest; the stub keeps the real env contract of lib/dev-ui.
vi.mock('../../apps/web/lib/dev-ui', () => ({ showDevDetails: () => process.env.SHOW_DEV_DETAILS === '1' }));

import ComparisonPage from '../../apps/web/app/porownaj/page';
import { StructuredView } from '../../apps/web/components/structured-view';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import type { SearchParams } from '../../apps/web/lib/catalogue';

afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

const fixtures = () => structuredClone(fixtureCatalogue);
const first = fixtureCatalogue[0]!;
const second = fixtureCatalogue[2]!;
const release = first.releaseId;
const payload = (entries = fixtureCatalogue) => ({ version: 1, datasetVersion: entries[0]!.releaseId, blocks: [{ type: 'racket_comparison', racketIds: [entries[0]!.id, entries[2]!.id] }] });
const view = (input: unknown, entries = fixtureCatalogue, dev = true) => renderToStaticMarkup(createElement(StructuredView, { input, entries, dev }));
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const page = async (params: SearchParams = {}) => renderToStaticMarkup(await ComparisonPage({ searchParams: Promise.resolve(params) }));
const pairParams = { release, left: first.id, right: second.id };

function expectNoComparisonFacts(html: string) {
  expect(html).not.toContain('aria-label="Zestawienie dwóch rakiet"');
  expect(html).not.toContain('365 ± 5 g');
  expect(html).not.toContain('372 g with one overgrip');
  expect(html).not.toContain('class="rating-value"');
  expect(html).not.toContain('class="provenance-details"');
}

describe('structured comparison renders only authoritative catalogue facts', () => {
  it('preserves exact identities, declared ranges and the separate measured specimen context', () => {
    const html = view(payload());
    expect(html).toContain(`href="/rakiety/${first.id}"`);
    expect(html).toContain(`href="/rakiety/${second.id}"`);
    expect(html).toContain('RAKIETA 1 · 2026');
    expect(html).toContain('RAKIETA 2 · 2026');
    expect(text(html)).toContain('Control');
    expect(text(html)).toContain('Pro');
    expect(html).toContain('360–370 g');
    expect(html).toContain('360–375 g');
    expect(html).toContain('365 ± 5 g');
    expect(html).toContain('367.5 ± 7.5 g');
    expect(html).toContain('372 g with one overgrip');
    expect(html).toContain('Pomiar egzemplarza');
    expect(html).toContain('Jeden overgrip; pojedynczy egzemplarz');
    expect(html).not.toContain('<strong>372 g</strong>');
    expect(html).toContain('fixture.orbit-control-measurement');
    expect(html).toContain('orbit-control-measurement');
    expect(html).toContain('Pobrano 13 października 2026');
    expect(html).toContain(release);
  });

  it('hides technical provenance and the release UUID unless developer mode is on', () => {
    const html = view(payload(), fixtureCatalogue, false);
    expect(html).not.toContain('provenance-details');
    expect(html).not.toContain('Ślad pochodzenia danych');
    expect(html).not.toContain('comparison-release');
    expect(html).not.toContain('fixture.orbit-control-measurement');
    expect(html).not.toContain(release);
    // Values, original observations, context and citations stay available.
    expect(html).toContain('372 g with one overgrip');
    expect(html).toContain('Pomiar egzemplarza');
    expect(html).toContain('Pobrano 13 października 2026');
    expect(html).toContain('<strong>Łezka</strong>');
    expect(view(payload(), fixtureCatalogue, true)).toContain('class="provenance-details"');
  });

  it('shows selected shape and conflicting raw observation without silently substituting the conflict', () => {
    const html = view(payload());
    expect(html).toContain('<strong>Łezka</strong>');
    expect(html).toContain('Diamond');
    expect(html).toContain('Rozbieżne źródła');
    expect(html).toContain('Ocena redakcyjna');
    expect(html).toContain('orbit-pro-shape-secondary');
    expect(html).not.toContain('<strong>Diament</strong>');
  });

  it('preserves distinct source scales and methodologies and never adds an aggregate score', () => {
    const entries = fixtures();
    const left = entries[0]!;
    const right = entries[2]!;
    const tenPointRating = left.ratings[0]!;
    tenPointRating.evidence = { ...tenPointRating.evidence, sourceCode: 'padeltrue', sourceName: 'PadelTrue', sourceUrl: 'https://example.com/synthetic-ten-point-review' };
    tenPointRating.methodology = 'https://padeltrue.com/methodology Synthetic ten-point method.';
    right.ratings = [{ ...structuredClone(tenPointRating), value: 82, scaleMin: 0, scaleMax: 100, rawValue: '82/100', methodology: 'https://padel.how/equipment/racket/methodology/ Synthetic hundred-point method.\nUnknown balance remains a caveat.', evidence: { ...tenPointRating.evidence, sourceCode: 'padelhow', sourceName: 'padel.how', observationId: 'synthetic-hundred-rating', sourceUrl: 'https://example.com/synthetic-hundred-point-review' } }];
    const html = view(payload(entries), entries);
    const renderedRatings = [...html.matchAll(/class="rating-value">([\s\S]*?)<\/p>/g)].map((match) => text(match[1]!));
    expect(renderedRatings).toEqual(['8 / 10', '82 / 100']);
    expect(html).toContain('aria-label="Oceny: PadelTrue"');
    expect(html).toContain('aria-label="Oceny: padel.how"');
    expect(html).toContain('Skala źródła: 0–10. Oryginał: 8/10.');
    expect(html).toContain('Skala źródła: 0–100. Oryginał: 82/100.');
    expect(html).toContain('href="https://padeltrue.com/methodology"');
    expect(html).toContain('href="https://padel.how/equipment/racket/methodology/"');
    expect(html).toContain('Synthetic ten-point method.');
    expect(html).toContain('Synthetic hundred-point method.');
    expect(html).toContain('Unknown balance remains a caveat.');
    expect(html).toContain('href="https://example.com/synthetic-ten-point-review"');
    expect(html).toContain('href="https://example.com/synthetic-hundred-point-review"');
    expect(html.match(/Brak ocen z tego źródła dla tej kategorii\./g)).toHaveLength(2);
    expect(html).toContain('CC BY 4.0');
  });

  it('renders a verified zero score and an invalid original without inventing a zero for the invalid score', () => {
    const entries = fixtures();
    entries[0]!.ratings[0]!.value = 0;
    entries[0]!.ratings[0]!.rawValue = '0/10';
    entries[2]!.ratings = [{ ...structuredClone(entries[0]!.ratings[0]!), value: null, rawValue: 'not evaluated', validationStatus: 'invalid', evidence: { ...entries[0]!.ratings[0]!.evidence, observationId: 'invalid-rating' } }];
    const html = view(payload(entries), entries);
    const values = [...html.matchAll(/class="rating-value">([\s\S]*?)<\/p>/g)].map((match) => text(match[1]!));
    expect(values).toEqual(['0 / 10', 'Nieustalona']);
    expect(html).toContain('Oryginał: not evaluated.');
    expect(html).toContain('Interpretacja oceny niepotwierdzona.');
  });

  it('keeps unknown year and missing parameters visible and retains an invalid unitless original only as evidence', () => {
    const entries = fixtures();
    const unknown = entries[5]!;
    unknown.specs.push({ ...structuredClone(entries[0]!.specs[1]!), key: 'balance_cm', rawValue: '~26.5', numericValue: null, valueMin: null, valueMax: null, unit: null, selected: false, validationStatus: 'unknown', evidence: { ...entries[0]!.specs[1]!.evidence, observationId: 'unknown-balance' } });
    const input = { version: 1, datasetVersion: release, blocks: [{ type: 'racket_comparison', racketIds: [first.id, unknown.id] }] };
    const html = view(input, entries);
    expect(html).toContain('ROK NIEZNANY');
    expect(html).toContain('Rocznik niepotwierdzony');
    expect(html).toContain('Brak danych');
    expect(html).toContain('~26.5');
    expect(html).toContain('Interpretacja niepotwierdzona — zachowano wartość oryginalną.');
    expect(html).not.toContain('26.5 cm');
    expect(html).not.toContain('<strong>0 g</strong>');
    expect(html).not.toContain('<strong>0 cm</strong>');
  });

  it('uses all three shared block renderers with facts resolved by ID, while omitting unused sources', () => {
    const entries = fixtures();
    // Unreferenced records must not add a source attribution to this view.
    entries[5]!.specs = [{ ...structuredClone(entries[0]!.specs[0]!), evidence: { ...entries[0]!.specs[0]!.evidence, sourceCode: 'padeltrue' } }];
    const input = { version: 1, datasetVersion: release, blocks: [
      { type: 'racket_card', racketId: first.id },
      { type: 'racket_specs', racketId: second.id },
      { type: 'racket_comparison', racketIds: [first.id, second.id] },
    ] };
    const html = view(input, entries);
    expect(html).toContain('class="racket-card"');
    expect(html).toContain('class="observation-list"');
    expect(html).toContain('aria-label="Zestawienie dwóch rakiet"');
    expect(html).toContain('365 ± 5 g');
    expect(html).toContain('Diamond');
    expect(html).not.toContain('CC BY 4.0');
  });

  it('escapes untrusted source text and literal field names and excludes executable source links', () => {
    const entries = fixtures();
    const malicious = entries[0]!.specs[0]!;
    malicious.key = '__proto__';
    malicious.rawValue = '<img src=x onerror=alert(1)>';
    malicious.normalizedText = '<script>hostile text</script>';
    malicious.evidence.sourceUrl = 'javascript:alert(1)';
    malicious.evidence.attribution = { name: '<b>fake manufacturer</b>', url: 'data:text/html,test', verified: false };
    const html = view(payload(entries), entries);
    expect(html).toContain('<h3>__proto__</h3>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;hostile text&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/<img[^>]*onerror=/);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="data:');
    expect(html).toContain('Przypisane producentowi — niezweryfikowane');
  });

  it.each([
    { ...payload(), html: '<script>injected</script>' },
    { ...payload(), blocks: [{ type: 'racket_comparison', racketIds: [first.id, second.id], weight: 999 }] },
    { ...payload(), blocks: [{ type: 'racket_card', racketId: first.id, sourceUrl: 'https://attacker.example/' }] },
    { ...payload(), blocks: [{ type: 'arbitrary_component', html: '<script>injected</script>' }] },
    { ...payload(), blocks: [{ type: 'racket_comparison', racketIds: [first.id, first.id] }] },
    { ...payload(), blocks: [{ type: 'racket_card', racketId: 'unknown-model' }] },
    { ...payload(), version: 2 },
    { ...payload(), datasetVersion: 'previous-release' },
  ])('fails closed before facts render for unsupported, malicious or stale payload %j', (input) => {
    const html = view(input);
    expect(html).toContain('Nie można wyświetlić widoku.');
    expectNoComparisonFacts(html);
    expect(html).not.toContain('TESTLAB');
    expect(html).not.toContain('attacker.example');
    expect(html).not.toContain('injected');
    expect(html).not.toContain('999');
  });

  it('fails closed when even an unreferenced dataset entry comes from another release', () => {
    const entries = fixtures();
    entries[5]!.releaseId = 'other-release';
    const html = view(payload(), entries);
    expect(html).toContain('Nie można wyświetlić widoku.');
    expectNoComparisonFacts(html);
  });
});

describe('comparison page states never silently replace a pinned publication', () => {
  it('renders a validated pair with exact picker selections and one current release', async () => {
    vi.stubEnv('SHOW_DEV_DETAILS', '1');
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: fixtureCatalogue });
    const html = await page(pairParams);
    expect(html).toContain('aria-label="Zestawienie dwóch rakiet"');
    expect(html).toContain('365 ± 5 g');
    expect(html).toContain('Supabase Dev.');
    expect(html).toContain('comparison-release');
    expect(html).not.toContain('Dane demonstracyjne.');
    expect(html).toContain(`name="release" value="${release}"`);
    expect(html).toContain(`name="left" value="${first.id}"`);
    expect(html).toContain(`name="right" value="${second.id}"`);
    expect(stubs.catalogue).toHaveBeenCalledTimes(1);
  });

  it('keeps the Supabase notice, provenance and release UUID out of the user view', async () => {
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: fixtureCatalogue });
    const html = await page(pairParams);
    expect(html).toContain('aria-label="Zestawienie dwóch rakiet"');
    expect(html).toContain('365 ± 5 g');
    expect(html).not.toContain('Supabase Dev.');
    expect(html).not.toContain('comparison-release');
    expect(html).not.toContain('provenance-details');
    expect(html).toContain(`name="release" value="${release}"`);
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'fixture', entries: fixtureCatalogue });
    expect(await page(pairParams)).toContain('Dane demonstracyjne.');
  });

  it('labels fixture data and provides explicit empty and one-sided selection states', async () => {
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'fixture', entries: fixtureCatalogue });
    const empty = await page();
    expect(empty).toContain('Co chcesz porównać?');
    expect(empty).toContain('Dane demonstracyjne.');
    expectNoComparisonFacts(empty);
    const partial = await page({ release, left: first.id });
    expect(partial).toContain('Dodaj drugą rakietę.');
    expect(partial).toContain(`name="left" value="${first.id}"`);
    expectNoComparisonFacts(partial);
  });

  it.each(['previous-release', undefined])('requires conscious recovery for stale or missing release %s', async (requestedRelease) => {
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: fixtureCatalogue });
    const html = await page({ ...pairParams, release: requestedRelease });
    expect(html).toContain('Wersja danych w tym odnośniku nie jest już aktualna.');
    expect(html).toContain('Porównaj w aktualnej wersji');
    expect(html).toContain(`name="release" value="${release}"`);
    expectNoComparisonFacts(html);
  });

  it.each([
    { ...pairParams, left: 'unknown-racket' },
    { ...pairParams, right: first.id },
    { ...pairParams, left: [first.id, second.id] },
    { ...pairParams, release: [release, 'other-release'] },
    { ...pairParams, left: '<script>malicious-user-input</script>' },
    { ...pairParams, html: '<script>malicious-user-input</script>' },
  ])('withholds facts for an invalid URL %j', async (params) => {
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: fixtureCatalogue });
    const html = await page(params);
    expect(html).toContain('Porównanie wymaga uwagi.');
    expectNoComparisonFacts(html);
    expect(html).not.toContain('malicious-user-input');
  });

  it.each(['setup', 'unavailable'])('does not fall back to fixture facts for unavailable catalogue state %s', async (status) => {
    stubs.catalogue.mockResolvedValue({ status, mode: 'supabase', entries: [] });
    const html = await page(pairParams);
    expect(html).toContain(status === 'setup' ? 'Katalog czeka na podłączenie danych.' : 'Nie udało się pobrać katalogu.');
    expect(html).not.toContain('TESTLAB');
    expect(html).not.toContain('Dane demonstracyjne.');
    expect(html).not.toContain('aria-label="Wybierz dwie rakiety"');
    expectNoComparisonFacts(html);
  });

  it.each([{ entries: [] }, { entries: [first, { ...second, releaseId: 'other-release' }] }] satisfies { entries: CatalogueEntry[] }[])('withholds comparison and picker for an empty or mixed-release published result', async ({ entries }) => {
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries });
    const html = await page(pairParams);
    expect(html).toContain('Brak danych do porównania.');
    expect(html).not.toContain('aria-label="Wybierz dwie rakiety"');
    expectNoComparisonFacts(html);
  });
});
