import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const stubs = vi.hoisted(() => ({ catalogue: vi.fn() }));
vi.mock('../../apps/web/lib/catalogue-server', () => ({ getCatalogue: stubs.catalogue }));
// CataloguePage embeds the client-side search, which reads the app router during render.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));
vi.mock('../../apps/web/lib/dev-ui', () => ({ showDevDetails: () => process.env.SHOW_DEV_DETAILS === '1' }));

import RacketPage from '../../apps/web/app/rakiety/[id]/page';
import CataloguePage from '../../apps/web/app/page';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';

afterEach(() => vi.resetAllMocks());

describe('released profile rendering with extensible source attributes', () => {
  it('renders prototype-shaped field names as literal source labels without crashing', async () => {
    const entry = structuredClone(fixtureCatalogue[0]!);
    entry.specs = ['__proto__', 'constructor', 'toString'].map((key, index) => ({
      ...entry.specs[0]!, key, selected: false,
      evidence: { ...entry.specs[0]!.evidence, observationId: `synthetic-extra-${index}` },
    }));
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: [entry] });
    const html = renderToStaticMarkup(await RacketPage({ params: Promise.resolve({ id: entry.id }) }));
    for (const key of ['__proto__', 'constructor', 'toString']) expect(html).toContain(`<h3>${key}</h3>`);
  });
  it.each([
    ['padelhow', 'padel.how', 'https://padel.how/equipment/racket/methodology/'],
    ['padeltrue', 'PadelTrue', 'https://padeltrue.com/methodology'],
  ])('renders %s score citations with methodology, retrieval date and the entire caveat', async (sourceCode, sourceName, methodology) => {
    // Synthetic ratings exercise real source attribution, without source corpus content.
    const entry = structuredClone(fixtureCatalogue[0]!);
    entry.specs = [];
    const rating = entry.ratings[0]!;
    rating.methodology = methodology + '\nBrak opublikowanego balansu; model używa wartości neutralnej.\nBrak oceny wartości dla tej waluty.';
    rating.evidence = { ...rating.evidence, sourceCode, sourceName, sourceUrl: 'https://example.com/synthetic-review', retrievedAt: '2026-10-14T10:00:00Z' };
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: [entry] });
    const html = renderToStaticMarkup(await RacketPage({ params: Promise.resolve({ id: entry.id }) }));
    expect(html).toContain(`href="${methodology}"`);
    // The group header's link reads "Metodologia" visually and "Metodologia ocen — {source}" for assistive technology.
    expect(html).toContain(`Metodologia<span class="sr-only"> ocen — ${sourceName}</span>`);
    expect(html).toContain('Pobrano 14 października 2026');
    expect(html).toContain('href="https://example.com/synthetic-review"');
    expect(html).toContain('Skala źródła: 0–10');
    expect(html).toContain('Brak opublikowanego balansu; model używa wartości neutralnej.');
    expect(html).toContain('Brak oceny wartości dla tej waluty.');
    expect(html.includes('CC BY 4.0')).toBe(sourceCode === 'padeltrue');
  });
  it('shows the PadelTrue licence and adaptation notice on the profile only when its data is shown, and not on the catalogue page', async () => {
    const entry = structuredClone(fixtureCatalogue[0]!);
    entry.specs[0]!.evidence.sourceCode = 'padeltrue';
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: [entry] });
    const profileHtml = renderToStaticMarkup(await RacketPage({ params: Promise.resolve({ id: entry.id }) }));
    expect(profileHtml).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
    expect(profileHtml).toContain('href="https://padeltrue.com/"');
    expect(profileHtml).toContain('Padłownia normalizuje nazwy, jednostki i strukturę danych');
    // The catalogue page no longer repeats the notice: the attribution is in the site footer (checked in catalogue.spec.ts).
    const catalogueHtml = renderToStaticMarkup(await CataloguePage({ searchParams: Promise.resolve({}) }));
    expect(catalogueHtml).toContain('class="racket-card"');
    expect(catalogueHtml).not.toContain('Padłownia normalizuje nazwy, jednostki i strukturę danych');
    expect(catalogueHtml).not.toContain('CC BY 4.0');
    const emptyHtml = renderToStaticMarkup(await CataloguePage({ searchParams: Promise.resolve({ q: 'no-matching-model' }) }));
    expect(emptyHtml).not.toContain('CC BY 4.0');
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'fixture', entries: fixtureCatalogue });
    for (const page of [await RacketPage({ params: Promise.resolve({ id: entry.id }) }), await CataloguePage({ searchParams: Promise.resolve({}) })]) {
      const html = renderToStaticMarkup(page);
      expect(html).toContain('Dane demonstracyjne.');
      expect(html).not.toContain('CC BY 4.0');
    }
  });
  it('does not render an executable methodology URL as a link or hide its source text', async () => {
    const entry = structuredClone(fixtureCatalogue[0]!);
    entry.ratings[0]!.methodology = 'javascript:alert(1)\n<script>untrusted</script>';
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'supabase', entries: [entry] });
    const html = renderToStaticMarkup(await RacketPage({ params: Promise.resolve({ id: entry.id }) }));
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;untrusted&lt;/script&gt;');
  });
});

describe('profile layout (UX v3 §7)', () => {
  const render = async (id: string, entries = fixtureCatalogue) => {
    stubs.catalogue.mockResolvedValue({ status: 'ready', mode: 'fixture', entries });
    return renderToStaticMarkup(await RacketPage({ params: Promise.resolve({ id }) }));
  };
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('puts the model in the h1, brand and year in the meta line and "Dodaj do porównania" in the header', async () => {
    const html = await render('fixture-orbit-control-2026');
    expect(html).toContain('<h1 class="page-header-title">Orbit</h1>');
    expect(html).toContain('<p>TESTLAB · 2026</p>');
    expect(html).toMatch(/<div class="page-header-actions">[^]*comparison-add/);
    expect(html).toContain('>Katalog</a>');
  });
  it('shows Parametry and Oceny side by side as two sections, without the retired hero, guides and eyebrows', async () => {
    const html = await render('fixture-orbit-control-2026');
    expect(html).toContain('<h2 id="spec-title">Parametry</h2>');
    expect(html).toContain('<h2 id="ratings-title">Oceny</h2>');
    expect(html.indexOf('id="spec-title"')).toBeLessThan(html.indexOf('id="ratings-title"'));
    for (const retired of ['profile-hero', 'profile-description', 'profile-key-specs', 'reading-guide', 'missing-specs', 'section-kicker', 'class="eyebrow', 'FAKTY Z KONTEKSTEM', 'PERSPEKTYWA ŹRÓDŁA', 'Ten profil dotyczy dokładnie', 'rating-card']) expect(html).not.toContain(retired);
  });
  it('renders the parameter rows with the comparison cell (value, source popover) and an explicit "Brak danych"', async () => {
    const html = await render('fixture-orbit-control-2026');
    expect(html).toMatch(/<dt class="spec-row-label">Kształt<\/dt><dd class="spec-row-cell"><div class="comparison-value"><strong>Okrągła<\/strong>/);
    expect(html).toMatch(/<dt class="spec-row-label">Masa<\/dt><dd class="spec-row-cell"><div class="comparison-value"><strong>360–370 g<\/strong>/);
    expect(html).toMatch(/<dt class="spec-row-label">Balans<\/dt><dd class="spec-row-cell"><p class="comparison-unknown">Brak danych<\/p>/);
    expect(html).toContain('aria-label="Źródło: Kształt: ');
  });
  it('groups ratings under their source with the shared caveat once and a bar in the source scale', async () => {
    const html = await render('fixture-orbit-control-2026');
    expect(html).toContain('class="rating-group-title"');
    expect(html).toContain('data-dimension="control"');
    expect(html).toContain('<meter class="stat-bar stat-bar-a" min="0" max="10" value="8"');
    expect(html.match(/class="rating-group-header"/g)).toHaveLength(1);
  });
  it('states the absence of ratings without computing one', async () => {
    const html = await render('fixture-orbit-pro-2026');
    expect(text(html)).toContain('Brak opublikowanych ocen dla tego wariantu. Nie wyliczamy własnej oceny liczbowej.');
    expect(html).not.toContain('rating-group-header');
  });
  it('keeps every observation in one collapsed section with a count and a one-line legend', async () => {
    const html = await render('fixture-orbit-control-2026');
    const count = fixtureCatalogue[0]!.specs.length;
    expect(html).toContain(`<details class="profile-observations"><summary>Wszystkie obserwacje źródeł (${count})</summary>`);
    expect(html).not.toContain('<details class="profile-observations" open');
    expect(html).toContain('class="profile-legend"');
    expect(html).toContain('Oryginał: <span class="raw-value">372 g with one overgrip</span>');
    expect(html).toContain('<p class="observation-value">372 g</p>');
  });
  it('keeps the conflict notice and both conflicting observations on a conflicting profile', async () => {
    const html = await render('fixture-orbit-pro-2026');
    expect(html).toContain('class="notice notice-warning"');
    expect(text(html)).toContain('Źródła podają rozbieżne parametry.');
    expect(html).toContain('Rozbieżne źródła');
    expect(html.match(/<h3>Kształt<\/h3>/g)).toHaveLength(2);
  });
  it('links other versions of the same model as chips with variant and year', async () => {
    const html = await render('fixture-orbit-pro-2026');
    expect(html).toContain('aria-label="Inne wersje"');
    expect(html).toContain(`<a class="chip-link" href="/rakiety/fixture-orbit-control-2026">Control · 2026</a>`);
    expect(html).toContain(`<a class="chip-link" href="/rakiety/fixture-orbit-control-2025">Control · 2025</a>`);
    expect(html).not.toContain('href="/rakiety/fixture-orbit-pro-2026"');
    expect(await render('fixture-vector-attack-2026')).toContain('chip-link');
    expect(await render('fixture-arc-unknown')).not.toContain('Inne wersje');
  });
  it('states an unknown year and an empty parameter list explicitly', async () => {
    const html = await render('fixture-arc-unknown');
    expect(html).toContain('<span class="badge badge-warning">Rocznik nieznany</span>');
    expect(html).toContain('Parametry jeszcze nieustalone.');
    expect(html).not.toContain('profile-observations');
  });
  it('labels fixture data on the profile', async () => {
    expect(await render('fixture-orbit-control-2026')).toContain('Dane demonstracyjne.');
  });
});
