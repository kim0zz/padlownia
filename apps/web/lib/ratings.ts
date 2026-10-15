import type { CatalogueRating } from '@padlownia/database';
import { methodologyCitation, ratingLabels } from './catalogue';

// The source's dimensions stay distinct: labels translate names without
// merging scales or conflating related dimensions from different sources.
export const ratingDimensionLabels: Readonly<Record<string, string>> = Object.freeze(Object.assign(Object.create(null) as Record<string, string>, {
  overall: 'Ocena ogólna',
  power: 'Moc',
  control: 'Kontrola',
  handling: 'Prowadzenie rakiety',
  forgiveness: 'Tolerancja błędów',
  comfort: 'Komfort',
  value: 'Stosunek jakości do ceny',
  maneuverability: 'Manewrowość',
  net_performance: 'Gra przy siatce',
  defensive_output: 'Gra w obronie',
  off_center_stability: 'Stabilność poza środkiem',
  sweet_spot: 'Pole optymalnego trafienia',
  spin_generation: 'Nadawanie rotacji',
  power_ceiling: 'Maksymalny potencjał mocy',
  power_accessibility: 'Łatwość uzyskania mocy',
}));

/** Position within the rating's own scale (0–1), or null when the value cannot be placed on it. */
export function ratingPosition(rating: CatalogueRating) {
  const { value, scaleMin, scaleMax } = rating;
  if (rating.validationStatus !== 'valid' || value === null || scaleMin === null || scaleMax === null
    || ![value, scaleMin, scaleMax].every(Number.isFinite) || scaleMax <= scaleMin || value < scaleMin || value > scaleMax) return null;
  return (value - scaleMin) / (scaleMax - scaleMin);
}

export const RATING_ORDER = ['overall', 'power', 'control', 'handling', 'maneuverability', 'comfort', 'forgiveness', 'sweet_spot', 'off_center_stability', 'spin_generation', 'power_accessibility', 'power_ceiling', 'defensive_output', 'net_performance', 'value'] as const;

/** Known dimensions in RATING_ORDER, unknown ones last in alphabetical order. */
export function sortDimensions(dims: string[]): string[] {
  const rank = (dimension: string) => { const index = (RATING_ORDER as readonly string[]).indexOf(dimension); return index === -1 ? RATING_ORDER.length : index; };
  return [...dims].sort((a, b) => rank(a) - rank(b) || (rank(a) < RATING_ORDER.length ? 0 : a.localeCompare(b, 'pl')));
}

/**
 * Methodology of one source group. `url` is set when every rating points at the same page,
 * `sharedNote` when every rating carries the same caveat; differing caveats stay per rating.
 */
export function groupMethodology(ratings: CatalogueRating[]): { url: string | null; sharedNote: string | null; hasDistinctNotes: boolean } {
  const citations = ratings.map((rating) => methodologyCitation(rating.methodology));
  const urls = new Set(citations.map((citation) => citation.url));
  const notes = new Set(citations.map((citation) => citation.note));
  const note = notes.size === 1 ? [...notes][0]! : '';
  return { url: urls.size === 1 ? [...urls][0]! : null, sharedNote: note || null, hasDistinctNotes: notes.size > 1 };
}

const scaleText = (rating: CatalogueRating) => `${rating.scaleMin ?? '?'}–${rating.scaleMax ?? '?'}`;

/** "skala 0–10", or "skale różne" when one source's ratings use different scales. */
export function groupScaleLabel(ratings: CatalogueRating[]): string {
  const scales = [...new Set(ratings.map(scaleText))];
  if (scales.length > 1) return 'skale różne';
  return scales[0] === undefined || scales[0] === '?–?' ? 'skala nieznana' : `skala ${scales[0]}`;
}

export function groupKindLabel(ratings: CatalogueRating[]): string {
  const kinds = [...new Set(ratings.map((rating) => ratingLabels[rating.kind] ?? 'Ocena źródła'))];
  return kinds.length === 1 ? kinds[0]!.toLocaleLowerCase('pl') : 'różne rodzaje';
}

/** The source flags a model whose data was incomplete when the rating was computed. */
export function isIncompleteModel(rating: CatalogueRating): boolean {
  return /brakuj|niepełne|missing|neutral/i.test(rating.methodology);
}
