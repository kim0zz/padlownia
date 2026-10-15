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
    expect(html).toContain(`Metodologia ocen — ${sourceName}`);
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
