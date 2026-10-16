/**
 * Deterministic racket mention resolver: free text → exact catalogue IDs, or an explicit ambiguity.
 * P-024: every variant and model year is its own product, so when the text fits several products
 * equally well we return them all and the assistant asks — it never silently picks one. When one
 * product fits best but more specific siblings exist ("Hack 04" vs "Hack 04 Hybrid"), it is resolved
 * and the siblings are returned as `alternatives` for the UI to offer.
 */

export interface ResolverCandidate { id: string; brand: string; name: string; year: number | null }
export type Resolution =
  | { status: 'resolved'; id: string; alternatives: string[]; matched: string }
  | { status: 'ambiguous'; ids: string[]; matched: string }
  | { status: 'not_found'; matched: string };

/** Words that tell variants apart. Missing ones make a query ambiguous; contradicting ones exclude a racket. */
const DISCRIMINATORS = new Set(['3k', '12k', '18k', '24k', 'pro', 'plus', 'light', 'lite', 'ls', 'team', 'motion', 'one', 'x', 'attack', 'hybrid',
  'control', 'ctrl', 'hrd', 'soft', 'variants', 'variantw', 'jr', 'junior', 'woman', 'women', 'air', 'counter', 'technical', 'geo', 'comfort', 'edge', 'cmf',
  'classics', 'smash', 'tour', 'court', 'power', 'elite', 'max', 'kids', 'ultralight', 'poly', 'polietileno', 'carbon', 'metal', 'ti', 'rose']);
const SPLIT = /\s*(?:\bvs\.?\b|\bversus\b|\bczy\b|\boraz\b|\bi\b|\ba\b|\bz\b|\bze\b|\bor\b|\band\b|,|;|\/)\s*/u;
const NOISE = new Set(['porownaj', 'pokaz', 'statystyki', 'rakieta', 'rakiety', 'rakiete', 'padel', 'review', 'jak', 'jaka', 'jaki', 'ktora', 'lepsza', 'lepiej',
  'czym', 'rozni', 'sie', 'od', 'do', 'dla', 'mi', 'the', 'by', 'edition', 'v', 'na', 'w', 'o', 'mam', 'chce', 'szukam']);

// A standalone capital S/W is a variant (Varlion "Elbowcare S/W"); lowercase "w"/"z" are Polish prepositions.
const fold = (text: string) => text.replace(/(^|[\s(])([SW])(?=[\s),.?!]|$)/g, '$1variant$2').normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase()
  .replace(/\+/g, ' plus ').replace(/(\d)[.,](\d)/g, '$1_$2');
export const resolverTokens = (text: string) => fold(text).match(/[\p{L}\p{N}_]+/gu)?.map((token) => token.replace(/_/g, '.')) ?? [];

const BRAND_ALIASES: Record<string, string[]> = { bullpadel: ['bull'], starvie: ['star vie'], 'drop shot': ['dropshot'], 'royal padel': ['royal'], 'stealth padel': ['stealth'] };

interface Prepared { candidate: ResolverCandidate; brand: string[]; brandAliases: string[][]; tokens: string[]; year: number | null }

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export class RacketResolver {
  private readonly prepared: Prepared[];
  private readonly idf = new Map<string, number>();

  constructor(candidates: ResolverCandidate[]) {
    this.prepared = candidates.map((candidate) => {
      const brand = resolverTokens(candidate.brand);
      const aliases = (BRAND_ALIASES[brand.join(' ')] ?? []).map(resolverTokens);
      const yearInName = candidate.name.match(/\b(20\d\d)\b/)?.[1];
      const tokens = resolverTokens(candidate.name).filter((token) => !brand.includes(token) && !/^20\d\d$/.test(token) && !NOISE.has(token));
      return { candidate, brand, brandAliases: aliases, tokens, year: candidate.year ?? (yearInName ? Number(yearInName) : null) };
    });
    const df = new Map<string, number>();
    for (const item of this.prepared) for (const token of new Set(item.tokens)) df.set(token, (df.get(token) ?? 0) + 1);
    for (const [token, count] of df) this.idf.set(token, Math.log(1 + this.prepared.length / count));
  }

  /** Resolve every racket mention in a question ("Porównaj X i Y" gives two). */
  resolveAll(text: string): Resolution[] {
    const whole = this.resolve(text);
    const parts = text.split(SPLIT).filter((part) => part.trim());
    const found: Resolution[] = [];
    parts.forEach((part, index) => {
      let result = this.resolve(part);
      // Ellipsis: "NOX AT10 12K czy 18K" — the second part borrows the model words of the first.
      if (result.status === 'not_found' && index > 0) {
        const carried = resolverTokens(parts[index - 1]!).filter((token) => !DISCRIMINATORS.has(token) && !NOISE.has(token)).join(' ');
        if (carried) result = this.resolve(`${carried} ${part}`);
      }
      if (result.status !== 'not_found' && !found.some((other) => key(other) === key(result))) found.push(result);
    });
    if (whole.status === 'resolved' && found.length <= 1) return [whole];
    return found.length ? found : [whole];
  }

  resolve(text: string): Resolution {
    const query = resolverTokens(text).filter((token) => !NOISE.has(token));
    const queryYear = query.find((token) => /^20\d\d$/.test(token));
    const words = query.filter((token) => !/^20\d\d$/.test(token));
    const matched = query.join(' ');
    const scored: { item: Prepared; score: number; extra: number }[] = [];
    const brandIn = (item: Prepared) => [item.brand, ...item.brandAliases].some((brand) => brand.length && brand.every((token) => words.includes(token)));
    // A brand named in the question excludes every other brand ("Babolat Pure Drive" is not an Oxdog Pure).
    const namedBrand = this.prepared.some(brandIn);
    for (const item of this.prepared) {
      const brandHit = brandIn(item);
      if (namedBrand && !brandHit) continue;
      const brandWords = new Set([...item.brand, ...item.brandAliases.flat()]);
      const rest = words.filter((token) => !brandWords.has(token));
      let score = 0, distinctive = 0, contradiction = false;
      for (const token of rest) {
        const exact = item.tokens.includes(token);
        const fuzzy = !exact && token.length >= 6 && item.tokens.some((name) => name.length >= 6 && editDistanceAtMostOne(name, token));
        if (exact || fuzzy) {
          score += (this.idf.get(token) ?? 1) * (fuzzy ? 0.8 : 1);
          if (!DISCRIMINATORS.has(token) && !/^\d/.test(token)) distinctive += 1;
          else if (/^\d/.test(token) && token.length >= 2) distinctive += 0.5;
        } else if (DISCRIMINATORS.has(token)) {
          contradiction = true; // asked for "Light", this racket is not a Light
        }
      }
      // Variant words alone ("Hybrid") identify nothing, unless the brand narrows it ("Kuikma Hybrid").
      if (contradiction || (distinctive < 1 && !(brandHit && score > 0))) continue;
      if (queryYear && item.year !== null && String(item.year) !== queryYear) continue;
      // Unrequested discriminators mean this is a more specific sibling than what was asked.
      const extra = item.tokens.filter((token) => DISCRIMINATORS.has(token) && !rest.includes(token)).length;
      score += (brandHit ? 2 : 0) - extra * 0.75;
      scored.push({ item, score, extra });
    }
    if (!scored.length) return { status: 'not_found', matched };
    scored.sort((left, right) => right.score - left.score);
    const best = scored[0]!;
    const close = scored.filter((entry) => best.score - entry.score < 0.7);
    if (close.length > 1) return { status: 'ambiguous', ids: close.slice(0, 6).map((entry) => entry.item.candidate.id), matched };
    // Siblings that lost only because they carry variant words the question did not use.
    const alternatives = scored.slice(1)
      .filter((entry) => entry.extra > best.extra && entry.score + (entry.extra - best.extra) * 0.75 >= best.score - 0.7)
      .slice(0, 5).map((entry) => entry.item.candidate.id);
    return { status: 'resolved', id: best.item.candidate.id, alternatives, matched };
  }
}

const key = (resolution: Resolution) => resolution.status === 'resolved' ? resolution.id : resolution.status === 'ambiguous' ? resolution.ids.join(',') : '';
