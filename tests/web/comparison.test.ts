import { describe, expect, it } from 'vitest';
import type { CatalogueEntry, CatalogueSpec } from '@padlownia/database';
import { fixtureCatalogue } from '../../apps/web/lib/fixtures';
import { canonicalSpecKey, comparisonRatingRows, comparisonRatingSources, comparisonRows, entryRatingGroups, entrySpecRows, racketLabel, rowDiffers, specDisplayValue } from '../../apps/web/lib/comparison';
import { resolveComparison } from '../../apps/web/lib/comparison-request';
import { comparisonUrl, readSelection, toggleSelection, type ComparisonSelection } from '../../apps/web/lib/comparison-selection';
import type { SearchParams } from '../../apps/web/lib/catalogue';

const release = fixtureCatalogue[0]!.releaseId;
const first = fixtureCatalogue[0]!;
const second = fixtureCatalogue[1]!;
const pairParams = { release, left: first.id, right: second.id };
const item = (entry: CatalogueEntry) => ({ id: entry.id, label: racketLabel(entry) });
const selection = (): ComparisonSelection => ({ releaseId: release, items: [item(first), item(second)] });
const spec = (changes: Partial<CatalogueSpec> = {}): CatalogueSpec => ({
  ...structuredClone(first.specs[1]!), key: 'weight', rawValue: '365 g',
  valueMin: null, valueMax: null, numericValue: null, normalizedText: null, ...changes,
});

describe('comparison keeps source observations and exact identities', () => {
  it('aligns rating categories despite differing input order or absent categories, retaining each scale and method', () => {
    const left = structuredClone(first);
    const right = structuredClone(second);
    const control = left.ratings[0]!;
    left.ratings.push({ ...control, dimension: 'power', evidence: { ...control.evidence, observationId: 'synthetic-power' } });
    right.ratings = [{ ...control, dimension: 'power', value: 75, scaleMax: 100, methodology: 'Different method and scale; no numeric comparison', evidence: { ...control.evidence, observationId: 'synthetic-power-right' } }];
    const rows = comparisonRatingRows(comparisonRatingSources(left, right)[0]!);
    expect(rows.map((row) => row.dimension)).toEqual(['control', 'power']);
    expect(rows[0]!.cells.map((cell) => cell.ratings.length)).toEqual([1, 0]);
    expect(rows[1]!.cells[0]!.ratings[0]).toBe(left.ratings[1]);
    expect(rows[1]!.cells[1]!.ratings[0]).toBe(right.ratings[0]);
    expect(rows[1]!.cells.map((cell) => cell.ratings[0]!.scaleMax)).toEqual([10, 100]);
  });
  it('distinguishes years and variants and labels absent identity information', () => {
    expect(racketLabel(first)).toBe('TESTLAB Orbit · Control · 2026');
    expect(racketLabel(second)).toBe('TESTLAB Orbit · Control · 2025');
    expect(racketLabel(fixtureCatalogue[2]!)).toBe('TESTLAB Orbit · Pro · 2026');
    expect(racketLabel({ ...first, variant: '', modelYear: null })).toBe('TESTLAB Orbit · Wariant nieustalony · Rok nieznany');
  });

  it.each([['weight_g', 'weight'], ['balance_cm', 'balance'], ['surface_material', 'surface'], ['core', 'core'], ['__proto__', '__proto__']])('maps only the known alias %s', (input, expected) => {
    expect(canonicalSpecKey(input)).toBe(expected);
  });

  it('joins aliases in one row without replacing or losing original evidence', () => {
    const left = structuredClone(first);
    const right = structuredClone(second);
    right.specs[1]!.key = 'weight_g';
    const original = structuredClone([left, right]);
    const rows = comparisonRows(left, right);
    const weights = rows.filter((row) => row.key === 'weight');
    expect(weights).toHaveLength(1);
    expect(weights[0]!.cells.map((cell) => cell.entryId)).toEqual([left.id, right.id]);
    expect(weights[0]!.cells[0]!.observations).toEqual([left.specs[1], left.specs[2]]);
    expect(weights[0]!.cells[0]!.selected).toEqual([left.specs[1]]);
    expect(weights[0]!.cells[1]!.selected[0]).toBe(right.specs[1]);
    expect(weights[0]!.cells[1]!.observations[0]!.key).toBe('weight_g');
    expect([left, right]).toEqual(original);
  });

  it('retains unknown fields, invalid originals and conflicts without treating them as canonical values', () => {
    const left = structuredClone(first);
    left.specs = [spec({ key: 'balance_cm', rawValue: '~26.5', unit: null, validationStatus: 'invalid', selected: true, conflict: true }), spec({ key: '__proto__', rawValue: 0, selected: false })];
    const right = structuredClone(fixtureCatalogue[5]!);
    const rows = comparisonRows(left, right);
    expect(rows.map((row) => row.key)).toEqual(['shape', 'weight', 'balance', 'core', 'surface', '__proto__']);
    expect(rows.find((row) => row.key === '__proto__')!.label).toBe('__proto__');
    const balance = rows.find((row) => row.key === 'balance')!;
    expect(balance.cells[0]!.observations[0]).toMatchObject({ rawValue: '~26.5', conflict: true, selected: true });
    expect(balance.cells[0]!.selected).toEqual([]);
    expect(balance.cells[1]!.observations).toEqual([]);
    expect(balance.cells[1]!.selected).toEqual([]);
    expect(rows.find((row) => row.key === 'weight')!.cells.every((cell) => cell.selected.length === 0)).toBe(true);
  });

  it.each([
    [{ numericValue: 365 }, '365 g'],
    [{ valueMin: 360, valueMax: 370 }, '360–370 g'],
    [{ valueMin: 360 }, 'Od 360 g'],
    [{ valueMax: 370 }, 'Do 370 g'],
    [{ key: 'weight_g', valueMin: 365, valueMax: 365 }, '365 g'],
    [{ key: 'balance_cm', numericValue: 26.5, unit: 'cm' }, '26.5 cm'],
    [{ key: 'balance', normalizedText: 'high', rawValue: 'Head heavy', unit: null }, 'Wysoki'],
    [{ key: 'shape', normalizedText: 'round', unit: null }, 'Okrągła'],
    [{ key: 'shape', normalizedText: 'constructor', unit: null }, 'constructor'],
    [{ key: 'thickness', numericValue: 0, unit: 'mm' }, '0 mm'],
    [{ key: 'balance', numericValue: 26.5, unit: null }, '26.5'],
    [{ key: 'thickness', valueMin: 36, valueMax: 38, unit: 'mm' }, '36–38 mm'],
    [{ key: 'thickness', valueMin: 36, unit: 'mm' }, 'Od 36 mm'],
    [{ key: 'thickness', valueMax: 38, unit: 'mm' }, 'Do 38 mm'],
    [{ key: 'surface', normalizedText: 'carbon', unit: null }, 'carbon'],
    [{ key: 'frame', rawValue: 0, unit: null }, '0'],
    [{ key: 'frame', rawValue: { declared: 'carbon' }, unit: null }, '{"declared":"carbon"}'],
    [{ validationStatus: 'invalid', numericValue: 365 }, 'Brak potwierdzonej wartości'],
    [{ validationStatus: 'unknown', rawValue: '~365' }, 'Brak potwierdzonej wartości'],
  ] satisfies [Partial<CatalogueSpec>, string][])('formats source values without guessed units or averaging: %j', (changes, expected) => {
    expect(specDisplayValue(spec(changes))).toBe(expected);
  });

  it('keeps ratings in separate source groups with unchanged scales, dimensions and missing sides', () => {
    const left = structuredClone(first);
    const right = structuredClone(second);
    const originalRating = left.ratings[0]!;
    right.ratings = [{ ...structuredClone(originalRating), rawValue: '82/100', value: 82, scaleMax: 100, methodology: 'Separate synthetic method', evidence: { ...originalRating.evidence, observationId: 'other-score', sourceCode: 'other-source', sourceName: 'Other source' } }];
    const before = structuredClone([left, right]);
    const groups = comparisonRatingSources(left, right);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.cells[0]!.ratings).toEqual([originalRating]);
    expect(groups[0]!.cells[1]!.ratings).toEqual([]);
    expect(groups[1]!.cells[0]!.ratings).toEqual([]);
    expect(groups[1]!.cells[1]!.ratings[0]).toBe(right.ratings[0]);
    expect(groups[1]!.cells[1]!.ratings[0]).toMatchObject({ dimension: 'control', value: 82, scaleMin: 0, scaleMax: 100, methodology: 'Separate synthetic method' });
    expect([left, right]).toEqual(before);
  });
});

describe('comparison URL validates the released exact pair', () => {
  it('makes an unselected request empty, and a pinned one-sided request partial', () => {
    expect(resolveComparison({}, fixtureCatalogue)).toMatchObject({ status: 'empty', left: '', right: '', currentRelease: release });
    for (const side of ['left', 'right']) {
      const result = resolveComparison({ release, [side]: first.id }, fixtureCatalogue);
      expect(result.status).toBe('partial');
      expect(result.payload).toBeUndefined();
    }
  });

  it('constructs only the two referenced IDs and the current release in the view contract', () => {
    expect(resolveComparison(pairParams, fixtureCatalogue)).toEqual({
      left: first.id, right: second.id, status: 'ready', currentRelease: release,
      payload: { version: 1, datasetVersion: release, blocks: [{ type: 'racket_comparison', racketIds: [first.id, second.id] }] },
    });
  });

  it.each([undefined, '', 'previous-release', 'unknown-release'])('requires explicit matching release: %s', (version) => {
    const result = resolveComparison({ ...pairParams, release: version }, fixtureCatalogue);
    expect(result).toMatchObject({ status: 'stale_release', left: first.id, right: second.id, currentRelease: release });
    expect(result.payload).toBeUndefined();
  });

  it.each(['left', 'right'])('rejects unknown %s IDs without resolving a similar model or adjacent year', (side) => {
    const result = resolveComparison({ ...pairParams, [side]: 'fixture-orbit-control-2024' }, fixtureCatalogue);
    expect(result.status).toBe('unknown_racket');
    expect(result[side as 'left' | 'right']).toBe('');
    expect(result.payload).toBeUndefined();
  });

  it('rejects a duplicate pair and an ambiguous duplicate catalogue identity', () => {
    expect(resolveComparison({ ...pairParams, right: first.id }, fixtureCatalogue).status).toBe('invalid_payload');
    const result = resolveComparison(pairParams, [...fixtureCatalogue, { ...first, model: 'Different source identity' }]);
    expect(result.status).toBe('unknown_racket');
    expect(result.payload).toBeUndefined();
  });

  it.each(['left', 'right', 'release'])('rejects repeated, malformed and overlong URL field %s', (key) => {
    for (const value of [[pairParams[key as keyof typeof pairParams]], ['a', 'b'], '<script>alert(1)</script>', ' id ', 'https://example.com/id', '../id', 'a'.repeat(129)]) {
      const result = resolveComparison({ ...pairParams, [key]: value }, fixtureCatalogue);
      expect(result.status).toBe('invalid_payload');
      expect(result.payload).toBeUndefined();
    }
  });

  it.each(['html', 'value', 'sourceUrl', 'third'])('rejects extra URL fields instead of accepting a hidden %s instruction', (key) => {
    const result = resolveComparison({ ...pairParams, [key]: 'untrusted' }, fixtureCatalogue);
    expect(result.status).toBe('invalid_payload');
    expect(result.payload).toBeUndefined();
  });

  it('rejects unsupported-only parameters before treating a request as an empty selection', () => {
    for (const params of [{ html: '<script>injected</script>' }, { third: ['a', 'b'] }, { sourceUrl: undefined }]) {
      expect(resolveComparison(params, fixtureCatalogue).status).toBe('invalid_payload');
    }
  });

  it('fails closed when there is no published dataset or its release lineage is mixed', () => {
    for (const entries of [[], [first, { ...second, releaseId: 'other-release' }]]) {
      const result = resolveComparison(pairParams, entries);
      expect(result).toMatchObject({ status: 'stale_release', currentRelease: '' });
      expect(result.payload).toBeUndefined();
    }
  });

  it('never mutates URL input or authoritative entries', () => {
    const params = { ...pairParams };
    const entries = structuredClone(fixtureCatalogue);
    const before = structuredClone(entries);
    resolveComparison(params, entries);
    expect(params).toEqual(pairParams);
    expect(entries).toEqual(before);
  });
});

describe('comparison selection transitions and optional persisted state', () => {
  it('adds exact years independently, rejects a third item and requires explicit removal', () => {
    const firstStep = toggleSelection(null, release, item(first));
    expect(firstStep.selection).toEqual({ releaseId: release, items: [item(first)] });
    const secondStep = toggleSelection(firstStep.selection, release, item(second));
    expect(secondStep.selection).toEqual(selection());
    const blocked = toggleSelection(secondStep.selection, release, item(fixtureCatalogue[2]!));
    expect(blocked.selection).toBe(secondStep.selection);
    expect(blocked.message).toContain('Usuń jedną');
    expect(firstStep.selection!.items).toEqual([item(first)]);
    const removed = toggleSelection(blocked.selection, release, item(first));
    expect(removed.selection).toEqual({ releaseId: release, items: [item(second)] });
    expect(toggleSelection(removed.selection, release, item(second)).selection).toBeNull();
  });

  it('does not mix releases or quietly remove a previously pinned ID from another release', () => {
    const current = selection();
    for (const entry of [first, fixtureCatalogue[2]!]) {
      const result = toggleSelection(current, 'new-release', item(entry));
      expect(result.selection).toBe(current);
      expect(result.message).toContain('innej wersji danych');
    }
    expect(current).toEqual(selection());
  });

  it('round-trips valid state to a pinned URL and to the validated comparison', () => {
    const state = readSelection(JSON.stringify(selection()))!;
    const url = new URL(comparisonUrl(state), 'https://example.com');
    expect(url.pathname).toBe('/porownaj');
    expect([...url.searchParams.keys()]).toEqual(['release', 'left', 'right']);
    expect(url.searchParams.get('release')).toBe(release);
    expect(url.searchParams.get('left')).toBe(first.id);
    expect(url.searchParams.get('right')).toBe(second.id);
    expect(url.href).not.toContain('TESTLAB');
    expect(resolveComparison(Object.fromEntries(url.searchParams) as SearchParams, fixtureCatalogue).status).toBe('ready');
    const partial = comparisonUrl({ releaseId: release, items: [item(first)] });
    expect(resolveComparison(Object.fromEntries(new URL(partial, url).searchParams), fixtureCatalogue).status).toBe('partial');
  });

  it.each([null, '', '{', 'null', '[]', '{}', 'x'.repeat(2001)])('ignores absent, corrupt or oversized persisted state: %s', (raw) => {
    expect(readSelection(raw)).toBeNull();
  });

  it.each([
    { releaseId: release, items: [] },
    { releaseId: release, items: [item(first), item(first)] },
    { releaseId: release, items: fixtureCatalogue.slice(0, 3).map(item) },
    { releaseId: release, items: [item(first)], html: '<script>' },
    { releaseId: release, items: [{ ...item(first), value: 999 }] },
    { releaseId: 'a'.repeat(129), items: [item(first)] },
    { releaseId: '<script>', items: [item(first)] },
    { releaseId: release, items: [{ id: '', label: 'Label' }] },
    { releaseId: release, items: [{ id: 'a'.repeat(129), label: 'Label' }] },
    { releaseId: release, items: [{ id: '../racket', label: 'Label' }] },
    { releaseId: release, items: [{ id: first.id, label: '' }] },
    { releaseId: release, items: [{ id: first.id, label: 'a'.repeat(501) }] },
  ])('rejects untrusted persisted values: %j', (value) => {
    expect(readSelection(JSON.stringify(value))).toBeNull();
  });

  it('accepts exact documented string limits while preserving stale IDs for explicit server validation', () => {
    const current = { releaseId: 'r'.repeat(128), items: [{ id: 'i'.repeat(128), label: 'l'.repeat(500) }] };
    expect(readSelection(JSON.stringify(current))).toEqual(current);
    const stale = { releaseId: 'previous-release', items: [item(first), item(second)] };
    expect(readSelection(JSON.stringify(stale))).toEqual(stale);
    const params = Object.fromEntries(new URL(comparisonUrl(stale), 'https://example.com').searchParams);
    expect(resolveComparison(params, fixtureCatalogue).status).toBe('stale_release');
  });
});

describe('comparison row order and differences (UX v3 §5.3)', () => {
  it('orders the key parameters first and everything else alphabetically by label', () => {
    const left = structuredClone(first);
    left.specs.push(spec({ key: 'player_level', rawValue: 'Advanced', normalizedText: 'advanced' }), spec({ key: 'frame', rawValue: 'carbon', normalizedText: 'carbon' }), spec({ key: 'zeta', rawValue: 'z' }), spec({ key: 'alpha', rawValue: 'a' }));
    expect(comparisonRows(left, second).map((row) => row.key)).toEqual(['shape', 'weight', 'balance', 'core', 'surface', 'frame', 'player_level', 'alpha', 'zeta']);
  });
  it('marks a row as different when values differ or only one side has one, and not when both are empty or equal', () => {
    const rows = comparisonRows(first, fixtureCatalogue[2]!);
    const byKey = (key: string) => rows.find((row) => row.key === key)!;
    expect(rowDiffers(byKey('shape'))).toBe(true);
    expect(rowDiffers(byKey('weight'))).toBe(true);
    expect(rowDiffers(byKey('core'))).toBe(false);
    expect(rowDiffers(comparisonRows(first, first).find((row) => row.key === 'weight')!)).toBe(false);
    expect(rowDiffers(comparisonRows(first, fixtureCatalogue[5]!).find((row) => row.key === 'shape')!)).toBe(true);
  });
});

describe('profile rows of one racket (UX v3 §7.2)', () => {
  it('uses the comparison order: key parameters first (even without data), then the rest alphabetically', () => {
    const entry = structuredClone(first);
    entry.specs.push(spec({ key: 'player_level', rawValue: 'Advanced', normalizedText: 'advanced' }), spec({ key: 'frame', rawValue: 'carbon', normalizedText: 'carbon' }), spec({ key: 'zeta', rawValue: 'z' }), spec({ key: 'alpha', rawValue: 'a' }));
    expect(entrySpecRows(entry).map((row) => row.key)).toEqual(['shape', 'weight', 'balance', 'core', 'surface', 'frame', 'player_level', 'alpha', 'zeta']);
    expect(entrySpecRows(entry).map((row) => row.key)).toEqual(comparisonRows(entry, entry).map((row) => row.key));
  });
  it('keeps the selected valid values apart from every original observation, and merges the weight_g alias into one row', () => {
    const weight = entrySpecRows(first).find((row) => row.key === 'weight')!;
    expect(weight.label).toBe('Masa');
    expect(weight.observations.length).toBeGreaterThan(weight.selected.length);
    expect(weight.selected.map(specDisplayValue)).toEqual(['360–370 g']);
    expect(weight.observations.some((observation) => observation.claimType === 'measured_specimen' && !observation.selected)).toBe(true);
    expect(entrySpecRows(first).filter((row) => row.key === 'weight')).toHaveLength(1);
  });
  it('lists unselected and invalid observations without selecting them, and shows empty key rows for a racket without data', () => {
    const entry = structuredClone(first);
    entry.specs = [spec({ key: 'weight_g', validationStatus: 'unknown', selected: true })];
    const weight = entrySpecRows(entry).find((row) => row.key === 'weight')!;
    expect(weight.observations).toHaveLength(1);
    expect(weight.selected).toEqual([]);
    const empty = entrySpecRows(fixtureCatalogue[5]!);
    expect(empty.map((row) => row.key)).toEqual(['shape', 'weight', 'balance', 'core', 'surface']);
    expect(empty.every((row) => row.observations.length === 0 && row.selected.length === 0)).toBe(true);
  });
  it('keeps both conflicting observations of one parameter in its row', () => {
    const shape = entrySpecRows(fixtureCatalogue[2]!).find((row) => row.key === 'shape')!;
    expect(shape.observations).toHaveLength(2);
    expect(shape.observations.some((observation) => observation.conflict)).toBe(true);
  });
  it('groups ratings by source and orders dimensions without merging scales', () => {
    const entry = structuredClone(first);
    const base = entry.ratings[0]!;
    entry.ratings = [
      { ...base, dimension: 'control', evidence: { ...base.evidence, observationId: 'synthetic-r1' } },
      { ...base, dimension: 'overall', evidence: { ...base.evidence, observationId: 'synthetic-r2' } },
      { ...base, dimension: 'power', scaleMax: 100, value: 80, evidence: { ...base.evidence, sourceCode: 'other', sourceName: 'Other source', observationId: 'synthetic-r3' } },
    ];
    const groups = entryRatingGroups(entry);
    expect(groups.map((group) => group.name)).toEqual([base.evidence.sourceName, 'Other source']);
    expect(groups[0]!.rows.map((row) => row.dimension)).toEqual(['overall', 'control']);
    expect(groups[1]!.rows.map((row) => row.dimension)).toEqual(['power']);
    expect(groups[1]!.ratings[0]!.scaleMax).toBe(100);
    expect(entryRatingGroups(fixtureCatalogue[5]!)).toEqual([]);
  });
});
