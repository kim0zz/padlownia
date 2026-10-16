// Self-contained (no relative imports): the web app imports this file directly through "@padlownia/domain/brands".
const brandKey = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * One display name per brand. Sources spell brands differently ("Cork" / "Cork Padel", "STARVIE" / "StarVie"),
 * which splits one brand into several filter options. Aliases are listed in display form so that a model name
 * starting with any of them ("Cork Padel Classic II") can still be shortened under the canonical brand.
 * This only affects presentation and filtering; identity keys used for matching are unchanged (see ROADMAP R3/R5).
 */
const BRANDS: readonly { name: string; aliases: readonly string[] }[] = [
  { name: "Cork", aliases: ["Cork Padel"] },
  { name: "StarVie", aliases: ["Star Vie"] },
  { name: "Quad", aliases: ["Quad Padel"] },
  { name: "Sane", aliases: [] },
  { name: "Volt", aliases: ["Volt Padel"] },
  { name: "Nox", aliases: [] },
  { name: "Lok", aliases: [] },
];

const byKey = new Map<string, (typeof BRANDS)[number]>();
for (const brand of BRANDS) for (const form of [brand.name, ...brand.aliases]) byKey.set(brandKey(form), brand);

/** "STARVIE" → "StarVie", "Cork Padel" → "Cork". Unknown brands are returned trimmed, otherwise as published. */
export function canonicalBrand(brand: string): string {
  return byKey.get(brandKey(brand))?.name ?? brand.trim();
}

/** Every known spelling of a brand (canonical name first), for shortening model names that repeat the brand. */
export function brandSpellings(brand: string): string[] {
  const known = byKey.get(brandKey(brand));
  return known ? [known.name, ...known.aliases] : [brand];
}
