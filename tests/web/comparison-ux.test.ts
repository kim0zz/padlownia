import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import { approvedImageFor, attachApprovedImages, catalogueImageSchema } from '../../apps/web/lib/catalogue-images';
import { RacketVisual } from '../../apps/web/components/racket-visual';
import { ratingPosition, RatingCard } from '../../apps/web/components/racket-details';
import { searchRacketOptions } from '../../apps/web/components/racket-combobox';
import { racketLabel } from '../../apps/web/lib/comparison';

const entry = fixtureCatalogue[0]!;
const approved = entry.image!;

describe('racket image rights and variant boundary', () => {
  it('never sends internal permission evidence to the client image component', () => {
    const image = approvedImageFor({ ...entry, image: { ...approved, permissionReference: 'private-evidence-2026-10-15' } });
    expect(image).toEqual({ url: approved.url, alt: approved.alt, credit: approved.credit, sourceUrl: approved.sourceUrl, licence: approved.licence });
    expect(JSON.stringify(image)).not.toContain('private-evidence');
    expect(approvedImageFor({ ...entry, image: { ...approved, racketId: 'another-variant' } })).toBeUndefined();
  });
  it('attaches only the exact approved release and identity while preserving facts', () => {
    const original = structuredClone(fixtureCatalogue);
    const result = attachApprovedImages(fixtureCatalogue, { version: 1, images: [approved] });
    expect(result[0]!.image).toEqual(approved);
    expect(result[1]!.image).toBeUndefined();
    expect(result[0]!.specs).toBe(entry.specs);
    expect(fixtureCatalogue).toEqual(original);
  });
  it.each([
    null, { version: 2, images: [approved] },
    { version: 1, images: [{ ...approved, rightsStatus: 'pending' }] },
    { version: 1, images: [{ ...approved, permissionReference: undefined }] },
    { version: 1, images: [{ ...approved, licence: 'data-only' }] },
    { version: 1, images: [{ ...approved, guessed: true }] },
    { version: 1, images: [{ ...approved, releaseId: 'older-release' }] },
    { version: 1, images: [{ ...approved, racketId: 'different-year' }] },
    { version: 1, images: [approved, approved] },
  ])('withholds images for missing, invalid, stale or ambiguous approval %j', (manifest) => {
    expect(attachApprovedImages([entry], manifest)[0]!.image).toBeUndefined();
  });
  it.each(['javascript:alert(1)', 'data:image/svg+xml,test', 'http://example.com/photo.jpg', 'https://user:secret@example.com/photo.jpg', 'https://127.0.0.1/photo.jpg', 'https://192.168.1.2/photo.jpg', 'https://[::1]/photo.jpg', 'https://example.com/photo.jpg?token=secret', '/media/rackets/../secret.svg', '/other/path.svg'])('rejects unsafe image locator %s', (url) => {
    expect(catalogueImageSchema.safeParse({ ...approved, url }).success).toBe(false);
  });
  it('allows a reviewed HTTPS asset, not implicit data-source photography permission', () => {
    expect(catalogueImageSchema.safeParse({ ...approved, url: 'https://example.com/approved-photo.webp' }).success).toBe(true);
    expect(catalogueImageSchema.safeParse({ url: 'https://example.com/unapproved.webp' }).success).toBe(false);
  });
  it('renders approved alt/credit and an explicit missing-image state', () => {
    const image = renderToStaticMarkup(createElement(RacketVisual, { entry }));
    expect(image).toContain('alt="Ilustracja syntetycznej rakiety');
    expect(image).toContain('referrerPolicy="no-referrer"');
    expect(image).toContain('Ilustracja TESTLAB');
    const missing = renderToStaticMarkup(createElement(RacketVisual, { entry: { ...entry, image: undefined } }));
    expect(missing).toContain('Zdjęcie niedostępne');
    expect(missing).not.toContain('<img');
  });
});

describe('search and source-scale visual encoding', () => {
  const options = fixtureCatalogue.map((racket) => ({ id: racket.id, label: racketLabel(racket), brand: racket.brand, year: racket.modelYear }));
  it('searches all typed words including year and variant, regardless of case', () => {
    expect(searchRacketOptions(options, 'CONTROL orbit 2025').map((option) => option.id)).toEqual(['fixture-orbit-control-2025']);
    expect(searchRacketOptions(options, 'unknown-model')).toEqual([]);
    expect(searchRacketOptions(options, '')).toHaveLength(6);
  });
  it('does not duplicate a brand already present in the original name', () => {
    expect(racketLabel({ ...entry, brand: 'Adidas', model: 'adidas Arrow' })).toBe('adidas Arrow · Control · 2026');
  });
  it('encodes a position only within an explicit original scale', () => {
    const rating = entry.ratings[0]!;
    expect(ratingPosition(rating)).toBe(0.8);
    expect(ratingPosition({ ...rating, value: 50, scaleMin: 0, scaleMax: 100 })).toBe(0.5);
    expect(ratingPosition({ ...rating, value: 0 })).toBe(0);
    for (const changed of [{ scaleMin: null }, { scaleMax: null }, { scaleMax: 0 }, { value: 11 }, { value: null }, { value: Infinity }, { validationStatus: 'unknown' as const }]) expect(ratingPosition({ ...rating, ...changed })).toBeNull();
    const html = renderToStaticMarkup(createElement(RatingCard, { rating }));
    expect(html).toContain('<meter');
    expect(html).toContain('min="0" max="10" value="8"');
    expect(html).toContain('Skala źródła: 0–10. Oryginał: 8/10.');
    expect(html).toContain(rating.methodology);
  });
});
