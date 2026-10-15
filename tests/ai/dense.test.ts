import { describe, expect, it } from 'vitest';
import { buildDenseIndex, buildLexicalIndex, dot, fuseRrf, passageText, retrieveDense, retrieveHybrid, stripNames, type ReviewChunk } from '@padlownia/ai';

// Synthetic chunks and hand-made unit vectors; no model is loaded in unit tests.
const chunk = (id: string, slug: string, kind: ReviewChunk['kind'], text: string): ReviewChunk => ({
  id, chunkerVersion: 'test', slug, kind, heading: kind, text, locator: { type: 'span', start: 0, end: 1 }, documentSha256: 'x', sourceUrl: null, mentions: [], approxTokens: 1,
});
const chunks = [
  chunk('a-power', 'a', 'power', 'Flat smashes need a full swing.'),
  chunk('a-defense', 'a', 'defense', 'Lobs from the back glass are easy.'),
  chunk('b-power', 'b', 'power', 'Smash power is explosive.'),
  chunk('b-net', 'b', 'net', 'Fast volleys at the net.'),
];
const unit = (...values: number[]) => { const length = Math.hypot(...values); return Float32Array.from(values.map((value) => value / length)); };
const vectors = new Map([['a-power', unit(1, 0, 0)], ['a-defense', unit(0, 1, 0)], ['b-power', unit(1, 0.1, 0)], ['b-net', unit(0, 0, 1)]]);
const dense = buildDenseIndex(chunks, vectors);

describe('dense retrieval', () => {
  it('ranks by cosine similarity within the resolved rackets only', () => {
    expect(dot(unit(1, 0), unit(1, 0))).toBeCloseTo(1);
    expect(retrieveDense(dense, unit(0, 1, 0), { slugs: ['a'], limit: 2 }).map((result) => result.chunk.id)).toEqual(['a-defense', 'a-power']);
    expect(retrieveDense(dense, unit(1, 0, 0), { slugs: ['b'] }).every((result) => result.chunk.slug === 'b')).toBe(true);
  });

  it('skips chunks without a vector and embeds the heading with the text', () => {
    expect(buildDenseIndex(chunks, new Map([['a-power', unit(1)]])).chunks.map((item) => item.id)).toEqual(['a-power']);
    expect(passageText(chunks[1]!)).toBe('defense\nLobs from the back glass are easy.');
  });
});

describe('fuseRrf', () => {
  const list = (...ids: string[]) => ids.map((id) => ({ chunk: chunks.find((item) => item.id === id)!, score: 0 }));

  it('sums 1/(k + rank) across lists, so agreement beats a single first place', () => {
    const fused = fuseRrf([list('a-power', 'a-defense'), list('a-defense', 'b-net')], { k: 60, limit: 3 });
    expect(fused.map((result) => result.chunk.id)).toEqual(['a-defense', 'a-power', 'b-net']);
    expect(fused[0]!.score).toBeCloseTo(1 / 62 + 1 / 61);
  });

  it('supports per-list weights', () => {
    const fused = fuseRrf([list('a-power'), list('a-defense')], { weights: [1, 2] });
    expect(fused[0]!.chunk.id).toBe('a-defense');
  });
});

describe('retrieveHybrid', () => {
  it('fuses lexical and vector evidence per racket and keeps both sides of a comparison', () => {
    const lexical = buildLexicalIndex(chunks);
    const results = retrieveHybrid(lexical, dense, 'smash power', unit(1, 0, 0), { slugs: ['a', 'b'], limit: 2 });
    expect(results.map((result) => result.chunk.id).sort()).toEqual(['a-power', 'b-power']);
  });

  it('a Polish question with no lexical match still retrieves through vectors', () => {
    const lexical = buildLexicalIndex(chunks);
    const results = retrieveHybrid(lexical, dense, 'zupełnie inne słowa', unit(0, 1, 0), { slugs: ['a'], limit: 1, expandPolishQuery: false });
    expect(results[0]!.chunk.id).toBe('a-defense');
  });
});

describe('stripNames', () => {
  it('removes the racket name but keeps the question wording for embedding', () => {
    expect(stripNames('Jak Bullpadel Vertex 05 2026 zachowuje się przy smeczu?', 'Bullpadel bullpadel vertex 05 2026')).toBe('Jak zachowuje się przy smeczu?');
    expect(stripNames('Bullpadel Vertex 05', 'Bullpadel vertex 05')).toBe('Bullpadel Vertex 05');
  });
});
