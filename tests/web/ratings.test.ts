import { describe, expect, it } from 'vitest';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import { groupKindLabel, groupMethodology, groupScaleLabel, isIncompleteModel, sortDimensions } from '../../apps/web/lib/ratings';

const base = fixtureCatalogue[0]!.ratings[0]!;
const rating = (changes: Partial<typeof base>) => ({ ...structuredClone(base), ...changes });

describe('lib/ratings', () => {
  it('sorts known dimensions by RATING_ORDER and unknown ones last alphabetically', () => {
    expect(sortDimensions(['value', 'zzz', 'control', 'aaa', 'overall'])).toEqual(['overall', 'control', 'value', 'aaa', 'zzz']);
  });
  it('shares a methodology link and caveat only when every rating agrees', () => {
    expect(groupMethodology([rating({ methodology: 'https://example.com/m Note' }), rating({ methodology: 'https://example.com/m Note' })])).toEqual({ url: 'https://example.com/m', sharedNote: 'Note', hasDistinctNotes: false });
    expect(groupMethodology([rating({ methodology: 'https://example.com/m A' }), rating({ methodology: 'https://example.com/m B' })])).toEqual({ url: 'https://example.com/m', sharedNote: null, hasDistinctNotes: true });
    expect(groupMethodology([rating({ methodology: 'https://example.com/m' })])).toEqual({ url: 'https://example.com/m', sharedNote: null, hasDistinctNotes: false });
    expect(groupMethodology([rating({ methodology: 'javascript:alert(1) x' })]).url).toBeNull();
  });
  it('describes scale and kind of a group without merging different ones', () => {
    expect(groupScaleLabel([rating({}), rating({})])).toBe('skala 0–10');
    expect(groupScaleLabel([rating({}), rating({ scaleMax: 100 })])).toBe('skale różne');
    expect(groupScaleLabel([rating({ scaleMin: null, scaleMax: null })])).toBe('skala nieznana');
    expect(groupKindLabel([rating({})])).toBe('ocena redakcyjna');
    expect(groupKindLabel([rating({}), rating({ kind: 'rule_derived' })])).toBe('różne rodzaje');
  });
  it('detects incomplete model data from the methodology caveat', () => {
    expect(isIncompleteModel(rating({ methodology: 'Neutral values for missing data' }))).toBe(true);
    expect(isIncompleteModel(rating({ methodology: 'Complete' }))).toBe(false);
  });
});
