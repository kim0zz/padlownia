import type { ReviewChunk, SectionKind } from './chunking.js';

/**
 * Offline lexical baseline (BM25) over review chunks. Free, deterministic and explainable:
 * the yardstick any embedding or model-based retriever must beat on the eval set.
 */

const STOPWORDS = new Set(('the and for with this that its are was but not you your can more than into from has have when which also very '
  + 'jak jest czy się nie dla przy oraz albo lub ten ta to tej tego jaka jaki jakie która który które ma są mi')
  .split(' '));

export function tokenize(text: string): string[] {
  return (text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .map(stem);
}

/** Tiny suffix stripper so "smashes/smashing" and "rakiety/rakieta" meet. Not a linguistic stemmer. */
function stem(token: string): string {
  if (/^\d/.test(token) || token.length <= 4) return token;
  const stripped = token.replace(/(ability|ably|able|ingly|ing|ers|ies|ed|ly|es|s|ami|ach|owi|ow|ie|y|a|e|i|u|o)$/u, '') || token;
  // "controlled" → "controll" → "control"
  return stripped.length > 4 ? stripped.replace(/([b-df-hj-np-tv-z])\1$/u, '$1') : stripped;
}

/**
 * Polish → English padel vocabulary used to expand Polish questions before matching English reviews.
 * Keys are compared after `tokenize` (lowercase, no diacritics, stemmed).
 */
const GLOSSARY: Record<string, string> = {
  moc: 'power', mocy: 'power', mocn: 'power', siatc: 'net volley', wybacz: 'forgiveness forgiving',
  praktyczn: 'practical', wniosk: 'takeaways practical', kort: 'court', korci: 'court', bandej: 'bandeja', vibor: 'vibora',
  wytrzymal: 'durability durable', generuj: 'generate', kontrolowan: 'control', smecz: 'smash', smeczu: 'smash', smecze: 'smash', bandeja: 'bandeja', vibora: 'vibora',
  kontrol: 'control', obron: 'defense defensive', bron: 'defense defensive', siatk: 'net volley', wolej: 'volley',
  sweet: 'sweet', spot: 'spot', wybaczaj: 'forgiveness forgiving', wybaczajac: 'forgiveness forgiving',
  rotacj: 'spin', podkrec: 'spin', miekk: 'soft', twardy: 'hard stiff', tward: 'hard stiff', sztywn: 'stiff stiffness',
  komfort: 'comfort', wygodn: 'comfort', lokc: 'elbow arm comfort', lokiec: 'elbow arm comfort', ramien: 'arm', wibracj: 'vibration',
  wag: 'weight', ciezk: 'heavy weight', lekk: 'light', balans: 'balance', glow: 'head', zwrotn: 'maneuverability handling',
  stabiln: 'stability stable', ksztalt: 'shape', diament: 'diamond', lz: 'teardrop', okragl: 'round',
  rdzen: 'core', piank: 'foam eva', wlokn: 'fiber carbon', wegl: 'carbon', wegiel: 'carbon', material: 'material',
  porown: 'compared comparison', roznic: 'difference compared', poprzedni: 'previous', wersj: 'version',
  poczatkuj: 'beginner', zaawansowan: 'advanced', srednio: 'intermediate', grac: 'player', gracz: 'player',
  lew: 'left side', praw: 'right side', stron: 'side', atak: 'attack attacking', ofensywn: 'attacking offensive',
  szybk: 'fast speed', glebok: 'depth', odbici: 'rebound response', czuci: 'feel',
};

export function expandPolish(tokens: string[]): string[] {
  const extra = tokens.flatMap((token) => {
    const hit = GLOSSARY[token] ?? Object.entries(GLOSSARY).find(([key]) => key.length >= 4 && token.startsWith(key))?.[1];
    return hit ? tokenize(hit) : [];
  });
  return [...tokens, ...extra];
}

/** Remove the words naming the resolved rackets, keeping the rest of the question verbatim (for embedding). */
export function stripNames(query: string, names: string): string {
  const ignored = new Set(tokenize(names));
  const kept = query.split(/\s+/).filter((word) => {
    const tokens = tokenize(word);
    return !tokens.length || !tokens.every((token) => ignored.has(token));
  }).join(' ');
  return kept.trim() || query;
}

export interface LexicalIndex { chunks: ReviewChunk[]; terms: Map<string, number>[]; lengths: number[]; df: Map<string, number>; averageLength: number }

export function buildLexicalIndex(chunks: ReviewChunk[]): LexicalIndex {
  const terms = chunks.map((chunk) => {
    const counts = new Map<string, number>();
    // The heading is part of what a section is "about"; count it twice.
    for (const token of [...tokenize(chunk.heading), ...tokenize(chunk.heading), ...tokenize(chunk.text)]) counts.set(token, (counts.get(token) ?? 0) + 1);
    return counts;
  });
  const lengths = terms.map((counts) => [...counts.values()].reduce((sum, value) => sum + value, 0));
  const df = new Map<string, number>();
  for (const counts of terms) for (const token of counts.keys()) df.set(token, (df.get(token) ?? 0) + 1);
  return { chunks, terms, lengths, df, averageLength: lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length) };
}

export interface RetrieveOptions {
  /** Exact catalogue slugs the question was resolved to. When given, nothing outside them is returned. */
  slugs?: string[];
  kinds?: SectionKind[];
  limit?: number;
  expandPolishQuery?: boolean;
  /**
   * Words naming the resolved rackets (brand, model, variant). Once retrieval is scoped to those rackets
   * they carry no information about *which aspect* is asked, and they over-reward sections that repeat the name.
   */
  ignoreText?: string;
}
export interface RetrievedChunk { chunk: ReviewChunk; score: number }

export function retrieveLexical(index: LexicalIndex, query: string, options: RetrieveOptions = {}): RetrievedChunk[] {
  const k1 = 1.2, b = 0.75;
  const ignored = new Set(tokenize(options.ignoreText ?? ''));
  const aspect = tokenize(query).filter((token) => !ignored.has(token));
  // A question that is only a racket name falls back to the full query.
  const base = aspect.length ? aspect : tokenize(query);
  const queryTokens = [...new Set(options.expandPolishQuery === false ? base : expandPolish(base))];
  const slugs = options.slugs ? new Set(options.slugs) : null;
  const kinds = options.kinds ? new Set(options.kinds) : null;
  const total = index.chunks.length;
  const results: RetrievedChunk[] = [];
  index.chunks.forEach((chunk, position) => {
    if (slugs && !slugs.has(chunk.slug)) return;
    if (kinds && !kinds.has(chunk.kind)) return;
    let score = 0;
    for (const token of queryTokens) {
      const frequency = index.terms[position]!.get(token);
      if (!frequency) continue;
      const df = index.df.get(token) ?? 0;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      score += idf * (frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * index.lengths[position]! / index.averageLength));
    }
    if (score > 0) results.push({ chunk, score });
  });
  results.sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id));
  return results.slice(0, options.limit ?? 5);
}

/**
 * For questions about several rackets: retrieve per racket and interleave, so a long review of one
 * racket cannot crowd out the evidence for the other side of a comparison.
 */
export function retrieveBalanced(index: LexicalIndex, query: string, options: RetrieveOptions & { slugs: string[] }): RetrievedChunk[] {
  const limit = options.limit ?? 5;
  const perSlug = Math.ceil(limit / options.slugs.length);
  const lists = options.slugs.map((slug) => retrieveLexical(index, query, { ...options, slugs: [slug], limit: perSlug }));
  const merged: RetrievedChunk[] = [];
  for (let rank = 0; rank < perSlug; rank += 1) for (const list of lists) if (list[rank]) merged.push(list[rank]!);
  return merged.slice(0, limit);
}
