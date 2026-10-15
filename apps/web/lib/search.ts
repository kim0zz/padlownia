export type RacketOption = { id: string; label: string; brand: string; year: number | null };

const fold = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pl').replaceAll('ł', 'l');

/** Every typed word must occur in the option label (case, diacritics and word order are ignored). */
export function searchRacketOptions(options: RacketOption[], query: string) {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  return options.filter((option) => words.every((word) => fold(option.label).includes(word)));
}
