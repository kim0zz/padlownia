import type { CatalogueEntry } from '@padlownia/database';

type ModelFields = Pick<CatalogueEntry, 'brand' | 'model' | 'modelYear'>;
type LabelFields = Pick<CatalogueEntry, 'brand' | 'model' | 'variant' | 'modelYear'>;

// Tokens that are written in capitals (EVA, CTRL, HR3, 12K); matched case-insensitively.
const ACRONYM = /^(eva|ctrl|edt|mtw|fx|hr\d+|\d+k)$/i;
// Splits a whitespace-free token into leading punctuation, the word core and trailing punctuation.
const TOKEN = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;

const lower = (value: string) => value.toLocaleLowerCase('pl');
const upper = (value: string) => value.toLocaleUpperCase('pl');
const capitalizeFirstLetter = (value: string) => value.replace(/\p{L}/u, (letter) => upper(letter));

/** Applies `transform` to the word core of a token and keeps surrounding punctuation, e.g. "(fiber" or "mtw),". */
function mapCore(token: string, transform: (core: string) => string): string {
  const [, lead = '', core = '', trail = ''] = TOKEN.exec(token) ?? [];
  return `${lead}${transform(core)}${trail}`;
}

/** "adidas Arrow Hit 2026" (brand "Adidas", year 2026) → "Arrow Hit". Falls back to the raw model if nothing is left. */
export function displayModel(entry: ModelFields): string {
  let model = entry.model;
  const brand = entry.brand;
  if (brand !== '' && lower(model.slice(0, brand.length + 1)) === lower(`${brand} `)) {
    model = model.slice(brand.length + 1);
  }
  if (entry.modelYear !== null) {
    const suffix = ` ${entry.modelYear}`;
    if (model.endsWith(suffix)) model = model.slice(0, -suffix.length);
  }
  return model.trim() || entry.model;
}

/** "ctrl pro" → "CTRL Pro". Empty or blank input → null. */
export function displayVariant(variant: string): string | null {
  const value = variant.trim();
  if (value === '') return null;
  const acronymOrCapitalized = (core: string) => (ACRONYM.test(core) ? upper(core) : capitalizeFirstLetter(core));
  return value.split(/\s+/).map((token) => mapCore(token, acronymOrCapitalized)).join(' ');
}

/** "hr3 eva" → "HR3 EVA"; only the first letter of the text is capitalised. Empty or null → null. */
export function displayMaterial(value: string | null): string | null {
  const text = value?.trim() ?? '';
  if (text === '') return null;
  const acronymOnly = (core: string) => (ACRONYM.test(core) ? upper(core) : core);
  return capitalizeFirstLetter(text).split(/\s+/).map((token) => mapCore(token, acronymOnly)).join(' ');
}

/** "adidas" → "Adidas", "NOX" → "NOX" (all-caps brands are kept as they are). */
export function displayBrand(brand: string): string {
  if (brand === upper(brand)) return brand;
  return capitalizeFirstLetter(brand);
}

/** "NOX · ML10 Pro Cup COORP by Miguel Lamperti · Pro · 2027" — for aria-labels and the comparison tray. */
export function displayLabel(entry: LabelFields): string {
  return `${displayBrand(entry.brand)} · ${displayModel(entry)} · ${displayVariant(entry.variant) ?? 'wariant nieustalony'} · ${entry.modelYear ?? 'rok nieznany'}`;
}
