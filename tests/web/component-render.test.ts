import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConflictNotice, ObservationDetails, RacketSpecs } from '../../apps/web/components/racket-details';
import { RatingGroups } from '../../apps/web/components/rating-groups';
import { RatingEntry } from '../../apps/web/components/rating-parts';
import { groupMethodology } from '../../apps/web/lib/ratings';
import { SourceCitation } from '../../apps/web/components/evidence';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';

const stubs = vi.hoisted(() => ({ catalogue: vi.fn(() => { throw new Error('Gallery must never read the database'); }) }));
vi.mock('../../apps/web/lib/catalogue-server', () => ({ getCatalogue: stubs.catalogue }));
vi.mock('../../apps/web/lib/dev-ui', () => ({ showDevDetails: () => process.env.SHOW_DEV_DETAILS === '1' }));
import ComponentGalleryPage from '../../apps/web/app/komponenty/page';

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('shared observations and citations', () => {
  it('preserves measured specimen context and a release-specific evidence trail', () => {
    const entry = fixtureCatalogue[0]!;
    const spec = entry.specs.find((item) => item.claimType === 'measured_specimen')!;
    const html = renderToStaticMarkup(createElement(ObservationDetails, { spec, releaseId: entry.releaseId, dev: true }));
    expect(html).toContain('372 g with one overgrip');
    // The normalised value leads; the source's own wording follows as "Oryginał: …".
    expect(html).toContain('<p class="observation-value">372 g</p>');
    expect(html).toContain('<p class="observation-original">Oryginał: <span class="raw-value">372 g with one overgrip</span></p>');
    expect(html).toContain('Pomiar egzemplarza');
    expect(html).toContain('Jeden overgrip; pojedynczy egzemplarz');
    expect(html).toContain('<summary>Ślad pochodzenia danych</summary>');
    expect(html).toContain(spec.evidence.observationId);
    expect(html).toContain(spec.evidence.path);
    expect(html).toContain(entry.releaseId);
    expect(html).not.toContain('Wartość katalogowa');
  });

  it('omits the technical evidence trail from the user view and keeps the citation', () => {
    const entry = fixtureCatalogue[0]!;
    const spec = entry.specs.find((item) => item.claimType === 'measured_specimen')!;
    for (const props of [{}, { dev: false }]) {
      const html = renderToStaticMarkup(createElement(ObservationDetails, { spec, releaseId: entry.releaseId, ...props }));
      expect(html).not.toContain('provenance-details');
      expect(html).not.toContain('Ślad pochodzenia danych');
      expect(html).not.toContain(spec.evidence.observationId);
      expect(html).not.toContain(spec.evidence.path);
      expect(html).not.toContain(entry.releaseId);
      expect(html).toContain('372 g with one overgrip');
      expect(html).toContain(spec.evidence.sourceName);
      expect(html).toContain('Pobrano ');
    }
    expect(renderToStaticMarkup(createElement(ObservationDetails, { spec, releaseId: entry.releaseId, dev: true }))).toContain(spec.evidence.observationId);
  });

  it('distinguishes an unverified manufacturer claim and an unknown interpretation', () => {
    const spec = structuredClone(fixtureCatalogue[0]!.specs[0]!);
    spec.evidence.attribution!.verified = false;
    spec.validationStatus = 'unknown';
    spec.selected = false;
    const html = renderToStaticMarkup(createElement(ObservationDetails, { spec, releaseId: 'fixture-release-01' }));
    expect(html).toContain('Przypisane producentowi — niezweryfikowane');
    expect(html).toContain('Interpretacja niepotwierdzona');
    expect(html).toContain(spec.rawValue);
    expect(html).not.toContain('Wartość katalogowa');
  });

  it('renders raw zero and source-supplied markup as literal data', () => {
    const spec = structuredClone(fixtureCatalogue[0]!.specs[0]!);
    spec.key = '__proto__';
    spec.rawValue = 0;
    spec.measurementContext = { note: '<script>untrusted</script>' };
    const html = renderToStaticMarkup(createElement(ObservationDetails, { spec, releaseId: 'fixture-release-01' }));
    expect(html).toContain('<h3>__proto__</h3>');
    expect(html).toContain('Oryginał: <span class="raw-value">0</span>');
    expect(html).toContain('&lt;script&gt;untrusted&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('keeps source and specific attribution links while rejecting executable URLs', () => {
    const evidence = structuredClone(fixtureCatalogue[0]!.specs[0]!.evidence);
    evidence.sourceUrl = 'https://example.com/synthetic-record';
    evidence.attribution!.url = 'https://example.com/synthetic-declaration';
    const html = renderToStaticMarkup(createElement(SourceCitation, { evidence }));
    expect(html).toContain('href="https://example.com/synthetic-record"');
    expect(html).toContain('href="https://example.com/synthetic-declaration"');
    evidence.sourceUrl = 'javascript:alert(1)';
    evidence.attribution!.url = 'data:text/html,<script>untrusted</script>';
    const unsafe = renderToStaticMarkup(createElement(SourceCitation, { evidence }));
    expect(unsafe).not.toContain('href=');
    expect(unsafe).toContain(evidence.sourceName);
  });

  it('renders both conflicting observations without merging their values', () => {
    const entry = fixtureCatalogue[2]!;
    const html = renderToStaticMarkup(createElement(RacketSpecs, { entry }));
    expect(html).toContain('teardrop');
    expect(html).toContain('Diamond');
    expect(html.match(/<h3>Kształt<\/h3>/g)).toHaveLength(2);
    expect(renderToStaticMarkup(createElement(ConflictNotice, { entry }))).toContain('Rozbieżność nie jest uśredniana');
    expect(renderToStaticMarkup(createElement(ConflictNotice, { entry: fixtureCatalogue[0]! }))).toBe('');
  });

  it('renders an explicit empty state without acquiring other variant data', () => {
    const html = renderToStaticMarkup(createElement(RacketSpecs, { entry: fixtureCatalogue[5]! }));
    expect(html).toContain('Parametry jeszcze nieustalone.');
    expect(html).not.toContain('360');
    expect(html).not.toContain('372');
  });
});

describe('shared source ratings', () => {
  const withRatings = (...ratings: (typeof fixtureCatalogue)[number]['ratings']) => ({ ...fixtureCatalogue[0]!, ratings });
  it('preserves original methodologies, independent scales and Polish dimensions', () => {
    const editorial = fixtureCatalogue[0]!.ratings[0]!;
    const derived = { ...editorial, dimension: 'power_accessibility', kind: 'rule_derived' as const, value: 65, scaleMax: 100, rawValue: '65/100',
      methodology: 'https://example.com/synthetic-methodology\nSyntetyczne zastrzeżenie źródła.',
      evidence: { ...editorial.evidence, observationId: 'derived-1', sourceCode: 'derived-source', sourceName: 'Syntetyczny model' } };
    const html = renderToStaticMarkup(createElement(RatingGroups, { entry: withRatings(editorial, derived) }));
    // Each source is its own group with its own scale; nothing is merged.
    expect(html.match(/class="rating-group"/g)).toHaveLength(2);
    expect(html).toContain('skala 0–10');
    expect(html).toContain('skala 0–100');
    expect(html).toContain('Ocena redakcyjna');
    expect(html).toContain('<p class="rating-row-label">Kontrola</p>');
    expect(html).toContain('Skala źródła: 0–10');
    expect(html).toContain('Wynik algorytmu');
    expect(html).toContain('<p class="rating-row-label">Łatwość uzyskania mocy</p>');
    expect(html).toContain('Skala źródła: 0–100');
    expect(html).toContain('href="https://example.com/synthetic-methodology"');
    expect(html).toContain('Syntetyczne zastrzeżenie źródła.');
  });

  it('does not promote invalid numbers and does not discard a validated zero', () => {
    const rating = { ...fixtureCatalogue[0]!.ratings[0]!, value: 0 };
    const entryHtml = (value: typeof rating) => renderToStaticMarkup(createElement(RatingEntry, { rating: value, group: groupMethodology([value]), tone: 'a', label: 'Kontrola' }));
    expect(entryHtml(rating)).toContain('<p class="rating-value">0<span class="rating-scale"> / 10</span></p>');
    const invalid = entryHtml({ ...rating, value: 11, validationStatus: 'invalid' });
    expect(invalid).toContain('<p class="rating-value">Nieustalona</p>');
    expect(invalid).toContain('Interpretacja oceny niepotwierdzona');
    expect(invalid).not.toContain('<meter');
    const unknownRating = { ...rating, dimension: 'constructor', value: null, scaleMin: null, scaleMax: null, rawValue: null, validationStatus: 'unknown' as const };
    const unknown = renderToStaticMarkup(createElement(RatingGroups, { entry: withRatings(unknownRating) }));
    expect(unknown).toContain('<p class="rating-row-label">constructor</p>');
    expect(unknown).toContain('Skala źródła: ?–?');
    expect(unknown).toContain('Oryginał: Brak wartości.');
  });
});

describe('component gallery isolation', () => {
  it('uses only explicit synthetic examples even when the app selects Supabase', () => {
    vi.stubEnv('CATALOGUE_MODE', 'supabase');
    const html = renderToStaticMarkup(createElement(ComponentGalleryPage));
    expect(stubs.catalogue).not.toHaveBeenCalled();
    expect(html).toContain('Dane demonstracyjne.');
    expect(html).toContain('TESTLAB');
    expect(html).not.toContain('Supabase Dev.');
    expect(html).toContain('Widok ze struktury danych');
    expect(html).toContain('racket_specs');
    expect(html).toContain('racket_comparison');
    expect(html).toContain('Parametry jeszcze nieustalone.');
    expect(html).toContain('Nie udało się pobrać katalogu.');
    expect(html).not.toContain('Dodaj do porównania');
    expect(html).not.toContain('href="/porownaj');
  });

  it('keeps every state of the former gallery on the page', () => {
    const html = renderToStaticMarkup(createElement(ComponentGalleryPage));
    for (const state of ['Pełna wartość', 'Brak wartości', 'Konflikt źródeł', 'Bez weryfikacji producenta', 'Niezweryfikowane', 'Nieznana jednostka', 'Pomiar egzemplarza', '~26.5',
      'Rozbieżne źródła', 'skala 0–10', 'skala 0–100', 'Niepełne dane modelu', 'Nieustalona', 'brak oceny', 'Brak opublikowanych ocen dla tego wariantu',
      'Co chcesz porównać', 'Dodaj drugą rakietę.', 'Wersja danych w tym odnośniku nie jest już aktualna']) expect(html, state).toContain(state);
    expect(html.match(/class="badge badge-(neutral|warning|info)"/g)?.length).toBeGreaterThanOrEqual(3);
    for (const tone of ['neutral', 'warning', 'info']) expect(html).toContain(`badge badge-${tone}`);
  });
});
