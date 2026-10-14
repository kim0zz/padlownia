import type { CatalogueEntry, CatalogueSpec } from '@padlownia/database';

export type CatalogueFilters = { q: string; brand: string; year: string; shape: string; page: number };
export type SearchParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 12;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
export function parseFilters(params: SearchParams): CatalogueFilters {
  return {
    q: first(params.q).trim().slice(0, 120),
    brand: first(params.brand).slice(0, 100),
    year: first(params.year).slice(0, 10),
    shape: first(params.shape).slice(0, 40),
    page: Math.max(1, Math.min(10000, Number.parseInt(first(params.page), 10) || 1)),
  };
}

function searchable(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pl').replaceAll('ł', 'l');
}

export function filterCatalogue(entries: CatalogueEntry[], filters: CatalogueFilters) {
  const words = searchable(filters.q).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    const text = searchable([entry.brand, entry.model, entry.variant, entry.modelYear].join(' '));
    return words.every((word) => text.includes(word))
      && (!filters.brand || entry.brand === filters.brand)
      && (!filters.year || String(entry.modelYear ?? 'unknown') === filters.year)
      && (!filters.shape || entry.shape === filters.shape);
  }).sort((a, b) => a.brand.localeCompare(b.brand, 'pl') || a.model.localeCompare(b.model, 'pl') || (b.modelYear ?? 0) - (a.modelYear ?? 0) || a.id.localeCompare(b.id));
}

export function catalogueUrl(filters: CatalogueFilters, page = 1) {
  const params = new URLSearchParams();
  for (const key of ['q', 'brand', 'year', 'shape'] as const) if (filters[key]) params.set(key, filters[key]);
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
  thickness: 'Grubość', player_level: 'Poziom gracza',
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

export function claimLabel(spec: CatalogueSpec) {
  if (spec.claimType === 'manufacturer_declared' && !spec.evidence.attribution?.verified) return 'Przypisane producentowi — niezweryfikowane';
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
