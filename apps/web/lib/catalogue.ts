import type { CatalogueEntry, CatalogueSpec } from '@padlownia/database';

export const weightFilters = ['lt355', '355-365', '365-375', 'gt375'] as const;
export const sortModes = ['newest', 'name', 'weight', 'ratings'] as const;
export type WeightFilter = '' | (typeof weightFilters)[number];
export type SortMode = (typeof sortModes)[number];
export type CatalogueFilters = { q: string; brand: string; year: string; shape: string; weight: WeightFilter; rated: '' | '1'; sort: SortMode; page: number };
export type SearchParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 24;

export const weightLabels: Readonly<Record<(typeof weightFilters)[number], string>> = {
  lt355: 'do 355 g', '355-365': '355–365 g', '365-375': '365–375 g', gt375: 'ponad 375 g',
};
export const sortLabels: Readonly<Record<SortMode, string>> = {
  newest: 'Najnowsze', name: 'Nazwa A–Z', weight: 'Masa rosnąco', ratings: 'Najwięcej ocen',
};
// Inclusive weight ranges in grams. Boundary values belong to both neighbouring ranges (overlap semantics).
const weightRanges: Readonly<Record<(typeof weightFilters)[number], readonly [number, number]>> = {
  lt355: [0, 354.99], '355-365': [355, 365], '365-375': [365, 375], gt375: [375.01, Number.POSITIVE_INFINITY],
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
const oneOf = <T extends string>(allowed: readonly T[], value: string): T | undefined => allowed.find((item) => item === value);
export function parseFilters(params: SearchParams): CatalogueFilters {
  return {
    q: first(params.q).trim().slice(0, 120),
    brand: first(params.brand).slice(0, 100),
    year: first(params.year).slice(0, 10),
    shape: first(params.shape).slice(0, 40),
    weight: oneOf(weightFilters, first(params.weight)) ?? '',
    rated: first(params.rated) === '1' ? '1' : '',
    sort: oneOf(sortModes, first(params.sort)) ?? 'newest',
    page: Math.max(1, Math.min(10000, Number.parseInt(first(params.page), 10) || 1)),
  };
}

function searchable(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pl').replaceAll('ł', 'l');
}

/** The declared weight as a closed interval; a single known bound is treated as a point. No weight → null. */
function weightInterval(entry: CatalogueEntry): readonly [number, number] | null {
  const low = entry.weightMinG ?? entry.weightMaxG;
  const high = entry.weightMaxG ?? entry.weightMinG;
  return low === null || high === null ? null : [Math.min(low, high), Math.max(low, high)];
}

function matchesWeight(entry: CatalogueEntry, filter: WeightFilter) {
  if (!filter) return true;
  const interval = weightInterval(entry);
  const [from, to] = weightRanges[filter];
  return interval !== null && interval[0] <= to && interval[1] >= from;
}

const byName = (a: CatalogueEntry, b: CatalogueEntry) =>
  a.brand.localeCompare(b.brand, 'pl') || a.model.localeCompare(b.model, 'pl') || (b.modelYear ?? 0) - (a.modelYear ?? 0) || a.id.localeCompare(b.id);

/** Missing values sort after present ones. */
function nullsLast(a: number | null, b: number | null, compare: (x: number, y: number) => number) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return compare(a, b);
}

const sorters: Record<SortMode, (a: CatalogueEntry, b: CatalogueEntry) => number> = {
  newest: (a, b) => nullsLast(a.modelYear, b.modelYear, (x, y) => y - x) || a.brand.localeCompare(b.brand, 'pl') || a.model.localeCompare(b.model, 'pl') || a.id.localeCompare(b.id),
  name: byName,
  weight: (a, b) => {
    const mid = (entry: CatalogueEntry) => { const interval = weightInterval(entry); return interval ? (interval[0] + interval[1]) / 2 : null; };
    return nullsLast(mid(a), mid(b), (x, y) => x - y) || byName(a, b);
  },
  ratings: (a, b) => b.ratings.length - a.ratings.length || byName(a, b),
};

export function filterCatalogue(entries: CatalogueEntry[], filters: CatalogueFilters) {
  const words = searchable(filters.q).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    const text = searchable([entry.brand, entry.model, entry.variant, entry.modelYear].join(' '));
    return words.every((word) => text.includes(word))
      && (!filters.brand || entry.brand === filters.brand)
      && (!filters.year || String(entry.modelYear ?? 'unknown') === filters.year)
      && (!filters.shape || entry.shape === filters.shape)
      && matchesWeight(entry, filters.weight)
      && (filters.rated !== '1' || entry.ratings.length > 0);
  }).sort(sorters[filters.sort]);
}

export function catalogueUrl(filters: CatalogueFilters, page = 1) {
  const params = new URLSearchParams();
  for (const key of ['q', 'brand', 'year', 'shape', 'weight', 'rated'] as const) if (filters[key]) params.set(key, filters[key]);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (page > 1) params.set('page', String(page));
  return params.size ? `/?${params}` : '/';
}

// Source attribute keys are extensible and untrusted. A dictionary must never
// resolve __proto__/constructor to inherited objects or functions for React.
const labels = (values: Record<string, string>): Readonly<Record<string, string>> =>
  Object.freeze(Object.assign(Object.create(null) as Record<string, string>, values));

export const shapeLabels = labels({ round: 'Okrągła', teardrop: 'Łezka', diamond: 'Diament', hybrid: 'Hybrydowa' });
export const specLabels = labels({
  shape: 'Kształt', weight: 'Masa', weight_g: 'Masa', balance: 'Balans', balance_cm: 'Balans',
  core: 'Rdzeń', surface: 'Powierzchnia', surface_material: 'Powierzchnia', frame: 'Rama',
  thickness: 'Grubość', player_level: 'Poziom gracza', firmness: 'Twardość', texture: 'Faktura powierzchni',
  court_side: 'Strona kortu', play_style: 'Styl gry', demand: 'Wymagalność', gender: 'Przeznaczenie', junior: 'Rakieta juniorska', profile_tags: 'Profil wg PadelTrue',
});
export const claimLabels = labels({
  manufacturer_declared: 'Deklaracja producenta', retailer_claim: 'Informacja sprzedawcy',
  measured_specimen: 'Pomiar egzemplarza', editorial_assessment: 'Ocena redakcyjna', unknown: 'Rodzaj nieustalony',
});
export const ratingLabels = labels({
  editorial: 'Ocena redakcyjna', rule_derived: 'Wynik algorytmu', measured: 'Ocena z pomiaru', unknown: 'Rodzaj oceny nieznany',
});

export function formatWeight(min: number | null, max: number | null) {
  if (min === null && max === null) return 'Brak danych';
  if (min === max) return `${min} g`;
  if (min === null) return `Do ${max} g`;
  if (max === null) return `Od ${min} g`;
  return `${min}–${max} g`;
}

/** A manufacturer claim whose attribution to the manufacturer has not been verified. */
export function isUnverifiedClaim(spec: CatalogueSpec) {
  return spec.claimType === 'manufacturer_declared' && !spec.evidence.attribution?.verified;
}

export function claimLabel(spec: CatalogueSpec) {
  if (isUnverifiedClaim(spec)) return 'Przypisane producentowi — niezweryfikowane';
  return claimLabels[spec.claimType] ?? 'Obserwacja źródła';
}

export function rawText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Brak wartości';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function safeSourceUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hostname.endsWith('.invalid')) return null;
    return url.href;
  } catch { return null; }
}

export function methodologyCitation(raw: string): { url: string | null; note: string } {
  const value = raw.trim();
  const parts = /^(\S+)(?:\s+([\s\S]*))?$/.exec(value);
  const url = safeSourceUrl(parts?.[1]);
  // The source may append a record-specific caveat after its methodology URL.
  // Link only the first token and keep every remaining word visible.
  return url ? { url, note: parts?.[2]?.trim() ?? '' } : { url: null, note: value };
}

export function formatDate(raw: string) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 'Data nieznana' : date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' });
}
