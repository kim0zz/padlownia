import type { CatalogueEntry, CatalogueSpec } from '@padlownia/database';
import { formatWeight, rawText, shapeLabels, specLabels } from './catalogue';

export function racketLabel(entry: CatalogueEntry) {
  return `${entry.brand} ${entry.model} · ${entry.variant || 'Wariant nieustalony'} · ${entry.modelYear ?? 'Rok nieznany'}`;
}

export function canonicalSpecKey(key: string) {
  if (key === 'weight_g') return 'weight';
  if (key === 'balance_cm') return 'balance';
  if (key === 'surface_material') return 'surface';
  return key;
}

export function comparisonRows(left: CatalogueEntry, right: CatalogueEntry) {
  const keys = new Set(['shape', 'weight', 'balance', 'core', 'surface', ...left.specs.map((spec) => canonicalSpecKey(spec.key)), ...right.specs.map((spec) => canonicalSpecKey(spec.key))]);
  return [...keys].map((key) => ({
    key, label: specLabels[key] ?? key,
    cells: [left, right].map((entry) => {
      const observations = entry.specs.filter((spec) => canonicalSpecKey(spec.key) === key);
      return { entryId: entry.id, observations, selected: observations.filter((spec) => spec.selected && spec.validationStatus === 'valid') };
    }),
  }));
}

export function specDisplayValue(spec: CatalogueSpec) {
  if (spec.validationStatus !== 'valid') return 'Brak potwierdzonej wartości';
  const key = canonicalSpecKey(spec.key);
  if (key === 'shape' && spec.normalizedText) return shapeLabels[spec.normalizedText] ?? spec.normalizedText;
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
