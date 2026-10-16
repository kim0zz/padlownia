import { describe, expect, it } from 'vitest';
import type { CatalogueRating } from '@padlownia/database';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import { buildTendency, isBuildProfile, visibleRatings } from '../../apps/web/lib/ratings';
import { comparisonRatingSources, entryRatingGroups } from '../../apps/web/lib/comparison';

const base = fixtureCatalogue[0]!.ratings[0]!;
const derived = (dimension: string, value: number | null, observationId = `${dimension}-${value}`): CatalogueRating =>
  ({ ...base, dimension, value, scaleMin: 0, scaleMax: 100, kind: 'rule_derived', evidence: { ...base.evidence, observationId, sourceCode: 'padeltrue', sourceName: 'PadelTrue' } });

describe('build profile (PadelTrue formula ratings)', () => {
  it('reads a formula rating as a tendency in words, never as a quality score', () => {
    expect([12, 35, 51, 62, 85].map((value) => buildTendency(derived('power', value)))).toEqual(['niski poziom', 'raczej niski poziom', 'średni poziom', 'raczej wysoki poziom', 'wysoki poziom']);
    expect(buildTendency(derived('power', null))).toBeNull();
    expect(isBuildProfile(base)).toBe(false);
  });
  it('hides the price-based "value" of a build profile everywhere, but keeps an editorial dimension of that name', () => {
    const editorialValue = { ...base, dimension: 'value' };
    expect(visibleRatings([derived('power', 51), derived('value', 18), editorialValue]).map((r) => `${r.kind}:${r.dimension}`)).toEqual(['rule_derived:power', 'editorial:value']);
    const entry = { ...fixtureCatalogue[0]!, ratings: [derived('power', 51), derived('value', 18)] };
    expect(entryRatingGroups(entry).flatMap((group) => group.rows.map((row) => row.dimension))).toEqual(['power']);
    expect(comparisonRatingSources(entry, entry)[0]!.cells[0]!.ratings.map((r) => r.dimension)).toEqual(['power']);
  });
});
