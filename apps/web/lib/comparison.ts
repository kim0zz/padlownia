import type { CatalogueEntry, CatalogueSpec } from '@padlownia/database';
import { formatWeight, rawText, shapeLabels, specLabels } from './catalogue';

export function racketLabel(entry: CatalogueEntry) {
  const name = entry.model.toLocaleLowerCase('pl').startsWith(`${entry.brand.toLocaleLowerCase('pl')} `) ? entry.model : `${entry.brand} ${entry.model}`;
  return `${name} · ${entry.variant || 'Wariant nieustalony'} · ${entry.modelYear ?? 'Rok nieznany'}`;
}

export function canonicalSpecKey(key: string) {
  if (key === 'weight_g') return 'weight';
  if (key === 'balance_cm') return 'balance';
  if (key === 'surface_material') return 'surface';
  return key;
}

/** Row order: the key parameters first, then everything else alphabetically by label. */
export const SPEC_ORDER: readonly string[] = ['shape', 'weight', 'balance', 'core', 'surface', 'frame', 'thickness', 'player_level'];

export function comparisonRows(left: CatalogueEntry, right: CatalogueEntry) {
  const keys = new Set(['shape', 'weight', 'balance', 'core', 'surface', ...left.specs.map((spec) => canonicalSpecKey(spec.key)), ...right.specs.map((spec) => canonicalSpecKey(spec.key))]);
  const rank = (key: string) => { const index = SPEC_ORDER.indexOf(key); return index === -1 ? SPEC_ORDER.length : index; };
  const sorted = [...keys].sort((a, b) => rank(a) - rank(b) || (rank(a) < SPEC_ORDER.length ? 0 : (specLabels[a] ?? a).localeCompare(specLabels[b] ?? b, 'pl')));
  return sorted.map((key) => ({
    key, label: specLabels[key] ?? key,
    cells: [left, right].map((entry) => {
      const observations = entry.specs.filter((spec) => canonicalSpecKey(spec.key) === key);
      return { entryId: entry.id, observations, selected: observations.filter((spec) => spec.selected && spec.validationStatus === 'valid') };
    }),
  }));
}

/** true when the selected values of the two rackets differ, or only one side has a value. */
export function rowDiffers(row: ReturnType<typeof comparisonRows>[number]): boolean {
  const [left, right] = row.cells.map((cell) => cell.selected.map(specDisplayValue).sort().join('|'));
  return left !== right;
}

export function specDisplayValue(spec: CatalogueSpec) {
  if (spec.validationStatus !== 'valid') return 'Brak potwierdzonej wartości';
  const key = canonicalSpecKey(spec.key);
  if (key === 'shape' && spec.normalizedText) return shapeLabels[spec.normalizedText] ?? spec.normalizedText;
  if (key === 'balance' && spec.normalizedText) {
    const balanceLabels = Object.assign(Object.create(null) as Record<string, string>, { head_heavy: 'Na główkę', head_light: 'Na rączkę', even: 'Zrównoważony', medium: 'Średni', high: 'Wysoki', low: 'Niski' });
    return balanceLabels[spec.normalizedText] ?? spec.normalizedText;
  }
  if (key === 'weight' && spec.unit === 'g') {
    const min = spec.valueMin ?? spec.numericValue;
    const max = spec.valueMax ?? spec.numericValue;
    if (min !== null || max !== null) return formatWeight(min, max);
  }
  if (spec.numericValue !== null) return `${spec.numericValue}${spec.unit ? ` ${spec.unit}` : ''}`;
  if (spec.valueMin !== null || spec.valueMax !== null) {
    const value = spec.valueMin !== null && spec.valueMax !== null ? `${spec.valueMin}–${spec.valueMax}` : spec.valueMin !== null ? `Od ${spec.valueMin}` : `Do ${spec.valueMax}`;
    return `${value}${spec.unit ? ` ${spec.unit}` : ''}`;
  }
  return spec.normalizedText || rawText(spec.rawValue);
}

// Ratings remain separate observations in their original scales and methodologies.
// Grouping by source is presentation only, never a numeric join or aggregate.
export function comparisonRatingSources(left: CatalogueEntry, right: CatalogueEntry) {
  const sources = new Map([...left.ratings, ...right.ratings].map((rating) => [rating.evidence.sourceCode, rating.evidence.sourceName]));
  return [...sources].map(([code, name]) => ({ code, name, cells: [left, right].map((entry) => ({
    entryId: entry.id, ratings: entry.ratings.filter((rating) => rating.evidence.sourceCode === code),
  })) }));
}

export function comparisonRatingRows(source: ReturnType<typeof comparisonRatingSources>[number]) {
  const dimensions = new Set(source.cells.flatMap((cell) => cell.ratings.map((rating) => rating.dimension)));
  return [...dimensions].map((dimension) => ({ dimension, cells: source.cells.map((cell) => ({
    entryId: cell.entryId, ratings: cell.ratings.filter((rating) => rating.dimension === dimension),
  })) }));
}
