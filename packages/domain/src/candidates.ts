import { canonicalBrand } from "./brands.js";
import { normalizeIdentityText } from "./resolution.js";

/**
 * Cross-source match candidates (ROADMAP R5). Proposes pairs of single-source rackets that are probably the same
 * product, each with reasons, for an owner decision. Nothing is merged here (P-008); a different model year is a
 * different product (P-024) and an explicit variant disagreement is never a candidate.
 */
export interface CandidateRacket { id: string; brand: string; model: string; variant: string; modelYear: number | null; sources: readonly string[] }
export interface MatchCandidate {
  left: CandidateRacket; right: CandidateRacket;
  score: number; confidence: "high" | "medium";
  reasons: string[];
  /** Another candidate shares one of the two rackets: the owner must pick. */
  ambiguous: boolean;
}

// Words that name the frame for the player or the seller, not a different product.
const NOISE = new Set(["padel", "racket", "pala", "raquette", "the", "edition", "series"]);
const SPELLINGS: Readonly<Record<string, string>> = { xtreme: "xtrem", plus: "plus", women: "woman", mujer: "woman", w: "woman", ultralight: "ultra light" };
const VARIANT_TOKENS = new Set(["attack", "control", "ctrl", "power", "pwr", "hybrid", "light", "lite", "soft", "hard", "pro", "woman", "junior", "comfort", "edge", "geo"]);

/** Model words without brand, year, player signature ("by Agustín Tapia", "- Tolito Aguirre") and seller noise. */
export function candidateTokens(racket: Pick<CandidateRacket, "brand" | "model" | "modelYear">): string[] {
  let text = racket.model.replace(/\s+-\s+.*$/u, " ").replace(/\bby\s+.*?(?=\s(?:19|20)\d{2}\b|$)/iu, " ");
  text = normalizeIdentityText(text);
  for (const spelling of [canonicalBrand(racket.brand), racket.brand]) {
    const brand = normalizeIdentityText(spelling);
    if (brand && (text === brand || text.startsWith(`${brand} `))) text = text.slice(brand.length).trim();
  }
  const words = text.split(" ").filter(Boolean)
    .filter((word) => !/^(?:19|20)\d{2}$/.test(word) && !NOISE.has(word))
    .flatMap((word) => (SPELLINGS[word] ?? word).split(" "));
  return [...new Set(words)];
}

// Colourways and edition words: a name that only adds these may still be the same frame (owner decides).
const SOFT = new Set(["blue", "red", "black", "white", "orange", "green", "pink", "grey", "gray", "gris", "negro", "silver", "gold", "lava", "night", "royal",
  "alum", "luxury", "orquidea", "limited", "special", "classics"]);
// Generations ("Deus II", "Supreme IV") are model codes like numbers.
const ROMAN = /^(?:ii|iii|iv|v|vi|vii|viii|ix|x{1,2})$/;
const codes = (tokens: string[]) => tokens.filter((token) => /\d/.test(token) || ROMAN.test(token)).sort().join(" ");
const variants = (tokens: string[]) => tokens.filter((token) => VARIANT_TOKENS.has(token)).sort().join(" ");

export function scorePair(left: CandidateRacket, right: CandidateRacket): Omit<MatchCandidate, "ambiguous"> | null {
  if (canonicalBrand(left.brand).toLowerCase() !== canonicalBrand(right.brand).toLowerCase()) return null;
  if (left.modelYear !== null && right.modelYear !== null && left.modelYear !== right.modelYear) return null;
  if (left.sources.some((source) => right.sources.includes(source))) return null;
  const a = candidateTokens(left), b = candidateTokens(right);
  if (!a.length || !b.length) return null;
  if (codes(a) !== codes(b)) return null;
  if (variants(a) !== variants(b)) return null;
  const shared = a.filter((token) => b.includes(token));
  // Both names add their own distinctive word ("Extreme One X" vs "Speed One X"): different models.
  const hardExtra = (own: string[], other: string[]) => own.filter((token) => !other.includes(token) && !SOFT.has(token));
  if (hardExtra(a, b).length && hardExtra(b, a).length) return null;
  const union = new Set([...a, ...b]).size;
  const score = shared.length / union;
  const subset = shared.length === Math.min(a.length, b.length);
  if (score < 0.5 && !(subset && shared.length >= 2)) return null;
  const reasons = ["same_brand", left.modelYear === right.modelYear ? "same_year" : "year_from_one_source", codes(a) ? "same_model_codes" : "no_model_codes", "same_variant_words"];
  if (score === 1) reasons.push("same_model_words");
  else reasons.push(subset ? "one_name_extends_the_other" : "most_model_words_shared");
  const confidence = score === 1 && left.modelYear === right.modelYear ? "high" : score >= 0.75 || (subset && codes(a)) ? "high" : "medium";
  return { left, right, score: Math.round(score * 100) / 100, confidence, reasons };
}

/**
 * Same model words, both years known but different (e.g. padel.how "2026" vs PadelTrue "2025"). Never a candidate
 * (P-024: a year is part of the identity), but worth a look: one source may have dated the review, not the frame.
 */
export function yearMismatches(rackets: readonly CandidateRacket[]): [CandidateRacket, CandidateRacket][] {
  const out: [CandidateRacket, CandidateRacket][] = [];
  for (let i = 0; i < rackets.length; i++) for (let j = i + 1; j < rackets.length; j++) {
    const [l, r] = [rackets[i]!, rackets[j]!];
    if (l.modelYear === null || r.modelYear === null || l.modelYear === r.modelYear) continue;
    if (canonicalBrand(l.brand).toLowerCase() !== canonicalBrand(r.brand).toLowerCase() || l.sources.some((s) => r.sources.includes(s))) continue;
    if (candidateTokens(l).join(" ") === candidateTokens(r).join(" ")) out.push([l, r]);
  }
  return out;
}

/** Candidate pairs between rackets that have different sources, best first; ambiguous ones are flagged, not resolved. */
export function matchCandidates(rackets: readonly CandidateRacket[]): MatchCandidate[] {
  const found: Omit<MatchCandidate, "ambiguous">[] = [];
  for (let i = 0; i < rackets.length; i++) for (let j = i + 1; j < rackets.length; j++) {
    const pair = scorePair(rackets[i]!, rackets[j]!);
    if (pair) found.push(pair);
  }
  const uses = new Map<string, number>();
  for (const pair of found) for (const id of [pair.left.id, pair.right.id]) uses.set(id, (uses.get(id) ?? 0) + 1);
  return found.map((pair) => ({ ...pair, ambiguous: (uses.get(pair.left.id) ?? 0) > 1 || (uses.get(pair.right.id) ?? 0) > 1 }))
    .sort((x, y) => y.score - x.score || x.left.brand.localeCompare(y.left.brand) || x.left.model.localeCompare(y.left.model));
}
