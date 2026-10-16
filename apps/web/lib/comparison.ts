import type { CatalogueEntry, CatalogueSpec } from '@padlownia/database';
import { formatWeight, rawText, shapeLabels, specLabels } from './catalogue';
import { sortDimensions } from './ratings';
import { identityDetails } from './display';

export function racketLabel(entry: CatalogueEntry) {
  const name = entry.model.toLocaleLowerCase('pl').startsWith(`${entry.brand.toLocaleLowerCase('pl')} `) ? entry.model : `${entry.brand} ${entry.model}`;
  return [name, ...identityDetails(entry)].join(' · ');
}

export function canonicalSpecKey(key: string) {
  if (key === 'weight_g') return 'weight';
  if (key === 'balance_cm') return 'balance';
  if (key === 'surface_material') return 'surface';
  return key;
}

/** Row order: the key parameters first, then everything else alphabetically by label. */
const vocab = (values: Record<string, string>) => Object.freeze(Object.assign(Object.create(null) as Record<string, string>, values));
const firmnessLabels = vocab({ soft: 'Miękka', 'medium-soft': 'Średnio miękka', medium: 'Średnia', 'medium-hard': 'Średnio twarda', hard: 'Twarda' });
const playerLevelLabels = vocab({ beginner: 'Początkujący', intermediate: 'Średniozaawansowany', advanced: 'Zaawansowany', professional: 'Profesjonalny', pro: 'Profesjonalny' });
const textureLabels = vocab({ rough: 'Szorstka', not_rough: 'Gładka', smooth: 'Gładka' });
const courtSideLabels = vocab({ both: 'Obie strony', right: 'Prawa', left: 'Lewa' });
const demandLabels = vocab({ demanding: 'Wymagająca', moderate: 'Umiarkowana', forgiving: 'Wybacza błędy' });
const genderLabels = vocab({ unisex: 'Uniwersalna', women: 'Damska', junior: 'Juniorska' });
const juniorLabels = vocab({ true: 'Tak', false: 'Nie' });
const playStyleLabels = vocab({ attacking: 'ofensywny', control: 'kontrola', 'all-round': 'uniwersalny', defensive: 'defensywny', 'net play': 'gra przy siatce', spin: 'rotacja' });
const profileTagLabels = vocab({ control: 'kontrola', power: 'moc', forgiving: 'wybacza błędy', 'arm-friendly': 'przyjazna dla ręki', 'easy to move': 'zwrotna', demanding: 'wymagająca', 'all-round': 'uniwersalna' });
const singleValueVocabularies = Object.freeze(Object.assign(Object.create(null) as Record<string, Readonly<Record<string, string>>>, {
  firmness: firmnessLabels, player_level: playerLevelLabels, texture: textureLabels, court_side: courtSideLabels, demand: demandLabels, gender: genderLabels, junior: juniorLabels,
}));
const listVocabularies = Object.freeze(Object.assign(Object.create(null) as Record<string, Readonly<Record<string, string>>>, { play_style: playStyleLabels, profile_tags: profileTagLabels }));

export const SPEC_ORDER: readonly string[] = ['shape', 'weight', 'balance', 'firmness', 'core', 'surface', 'texture', 'frame', 'thickness', 'player_level', 'play_style', 'demand', 'court_side', 'gender', 'profile_tags'];

/**
 * Racket characteristics that only reviewers assess (no manufacturer value exists). The projection never selects an
 * editorial assessment as a catalogue value, so without this they would read "no data" although the source rates them.
 * A single consistent editorial value is shown, with its source and claim type one click away (P-032).
 */
const EDITORIAL_CHARACTERISTICS: readonly string[] = ['court_side', 'demand', 'gender', 'play_style'];
// Folded into "Przeznaczenie" (gender): a junior frame is shown as "Juniorska".
const HIDDEN_SPEC_KEYS: readonly string[] = ['junior'];

/** Keys present on any of the entries, in SPEC_ORDER / alphabetical order. */
function orderedSpecKeys(entries: readonly CatalogueEntry[]) {
  const keys = new Set(entries.flatMap((entry) => entry.specs.map((spec) => canonicalSpecKey(spec.key))).filter((key) => !HIDDEN_SPEC_KEYS.includes(key)));
  const rank = (key: string) => { const index = SPEC_ORDER.indexOf(key); return index === -1 ? SPEC_ORDER.length : index; };
  return [...keys].sort((a, b) => rank(a) - rank(b) || (rank(a) < SPEC_ORDER.length ? 0 : (specLabels[a] ?? a).localeCompare(specLabels[b] ?? b, 'pl')));
}

/** All observations of one parameter of one racket, and the valid selected ones among them. */
function specCell(entry: CatalogueEntry, key: string) {
  const observations = entry.specs.filter((spec) => canonicalSpecKey(spec.key) === key);
  let selected = observations.filter((spec) => spec.selected && spec.validationStatus === 'valid');
  if (!selected.length && EDITORIAL_CHARACTERISTICS.includes(key) && !observations.some((spec) => spec.conflict)) {
    selected = observations.filter((spec) => spec.validationStatus === 'valid' && spec.claimType === 'editorial_assessment').slice(0, 1);
  }
  const junior = entry.specs.some((spec) => spec.key === 'junior' && spec.validationStatus === 'valid' && spec.rawValue === true);
  if (key === 'gender' && junior) selected = selected.map((spec) => ({ ...spec, normalizedText: 'junior' }));
  return { observations, selected };
}

const hasContent = (cell: ReturnType<typeof specCell>) => cell.selected.length > 0 || cell.observations.some((spec) => spec.conflict);

/**
 * One row per parameter that at least one of the two rackets has a value (or a disclosed conflict) for (P-046).
 * `withObservationsOnly` keeps every parameter with any observation, for the full observation list.
 */
export function comparisonRows(left: CatalogueEntry, right: CatalogueEntry, withObservationsOnly = false) {
  return orderedSpecKeys([left, right]).map((key) => ({
    key, label: specLabels[key] ?? key,
    cells: [left, right].map((entry) => ({ entryId: entry.id, ...specCell(entry, key) })),
  })).filter((row) => withObservationsOnly || row.cells.some(hasContent));
}

/** Rows of the profile's parameter table: the same order and cell content as one comparison column; empty rows are left out. */
export function entrySpecRows(entry: CatalogueEntry) {
  return orderedSpecKeys([entry]).map((key) => ({ key, label: specLabels[key] ?? key, ...specCell(entry, key) })).filter(hasContent);
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
    const balanceLabels = Object.assign(Object.create(null) as Record<string, string>, { head_heavy: 'Na główkę', head_light: 'Na rączkę', even: 'Zrównoważony', medium: 'Średni', high: 'Wysoki', low: 'Niski', medium_high: 'Średnio wysoki', medium_low: 'Średnio niski' });
    return balanceLabels[spec.normalizedText] ?? spec.normalizedText;
  }
  // Source vocabularies with a closed set of values are translated; free text stays as the source wrote it.
  const vocabulary = singleValueVocabularies[key];
  if (key === 'junior' && typeof spec.rawValue === 'boolean') return juniorLabels[String(spec.rawValue)]!;
  if (vocabulary && spec.normalizedText && vocabulary[spec.normalizedText]) return vocabulary[spec.normalizedText]!;
  const list = listVocabularies[key];
  if (list && Array.isArray(spec.rawValue) && spec.rawValue.every((item) => typeof item === 'string' && list[item])) {
    const text = (spec.rawValue as string[]).map((item) => list[item]!).join(', ');
    return text.charAt(0).toLocaleUpperCase('pl') + text.slice(1);
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

/** Ratings of one racket grouped by source, then by dimension in display order. Presentation only: scales are never joined. */
export function entryRatingGroups(entry: CatalogueEntry) {
  const sources = new Map(entry.ratings.map((rating) => [rating.evidence.sourceCode, rating.evidence.sourceName]));
  return [...sources].map(([code, name]) => {
    const ratings = entry.ratings.filter((rating) => rating.evidence.sourceCode === code);
    const rows = sortDimensions([...new Set(ratings.map((rating) => rating.dimension))])
      .map((dimension) => ({ dimension, ratings: ratings.filter((rating) => rating.dimension === dimension) }));
    return { code, name, ratings, rows };
  });
}
