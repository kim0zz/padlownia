import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RacketCard } from '../../apps/web/components/catalogue';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import type { IllustratedCatalogueEntry } from '../../apps/web/lib/catalogue-images';

const card = (entry: IllustratedCatalogueEntry) => renderToStaticMarkup(createElement(RacketCard, { entry }));
const [control2026, control2025, pro2026, , , unknownYear] = fixtureCatalogue as [IllustratedCatalogueEntry, IllustratedCatalogueEntry, IllustratedCatalogueEntry, IllustratedCatalogueEntry, IllustratedCatalogueEntry, IllustratedCatalogueEntry];

describe('racket card (catalogue and racket_card block)', () => {
  it('keeps the exact profile link label and drops the ordinal number and the old footer', () => {
    const html = card(control2026);
    expect(html).toContain('class="racket-card"');
    expect(html).toContain('aria-label="Zobacz profil TESTLAB Orbit Control 2026"');
    expect(html).toContain('href="/rakiety/fixture-orbit-control-2026"');
    expect(html).not.toContain('card-number');
    expect(html).not.toContain('card-bottom');
    expect(html).not.toContain('Parametry ze źródłami');
  });
  it('shows one line of facts with a single source popover and the ratings sources', () => {
    const html = card(control2026);
    expect(html).toContain('Okrągła · 360–370 g');
    expect(html.match(/<details class="source-info"/g)).toHaveLength(1);
    expect(html).toContain('Syntetyczny producent');
    expect(html).toContain('Oceny: Syntetyczna redakcja');
    // Both values are explained in the popover, each introduced by its parameter name.
    expect(html).toContain('Kształt: Deklaracja producenta');
    expect(html).toContain('Masa: Deklaracja producenta');
  });
  it('shows an explicit "Brak ocen", the year as a badge and the brand/model split', () => {
    const html = card(control2025);
    expect(html).toContain('Brak ocen');
    expect(html).toContain('<span class="badge badge-neutral">2025</span>');
    expect(html).toContain('>TESTLAB<');
    expect(html).toContain('>Orbit</a>');
    expect(html).toContain('>Control<');
  });
  it('marks unknown year, unknown weight/shape and an unknown variant on the first layer', () => {
    const html = card({ ...unknownYear, variant: '' });
    expect(html).toContain('<span class="badge badge-warning">Rok nieznany</span>');
    expect(html).toContain('wariant nieustalony');
    expect(html).toContain('Kształt i masa nieustalone');
    expect(html).not.toContain('<details');
  });
  it('keeps a source conflict visible as a badge', () => {
    expect(card(pro2026)).toContain('<span class="badge badge-warning">Rozbieżne źródła</span>');
    expect(card(control2026)).not.toContain('Rozbieżne źródła');
  });
  it('keeps an unverified manufacturer attribution in the source popover, not as a warning badge', () => {
    // Real Dev data: ~40% of cards carry an unverified attribution, so a per-card warning badge is noise.
    const entry = structuredClone(control2026);
    entry.specs[0]!.evidence.attribution!.verified = false;
    expect(card(entry)).toContain('Przypisane producentowi — niezweryfikowane');
    expect(card(entry)).not.toContain('badge-warning');
    expect(card(control2026)).not.toContain('niezweryfikowane');
  });
  it('renders a thumbnail only for an approved image and no placeholder otherwise', () => {
    const withImage = card(control2026);
    expect(withImage).toContain('<img');
    expect(withImage).toContain('Ilustracja TESTLAB');
    const without = card(control2025);
    expect(without).not.toContain('<img');
    expect(without).not.toContain('racket-visual');
    expect(without).not.toContain('Zdjęcie niedostępne');
  });
  it('renders hostile source text escaped', () => {
    const entry = structuredClone(control2026);
    entry.ratings[0]!.evidence.sourceName = '<script>alert(1)</script>';
    const html = card(entry);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
