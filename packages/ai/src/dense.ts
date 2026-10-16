import type { ReviewChunk, SectionKind } from './chunking.js';
import { retrieveLexical, type LexicalIndex, type RetrievedChunk, type RetrieveOptions } from './lexical.js';

/**
 * Vector (dense) retrieval and hybrid fusion. Embeddings are produced elsewhere (local model in the
 * worker, or a paid API later); this module only ranks normalized vectors and fuses ranked lists.
 */
export interface Embedder {
  embedQueries(texts: string[]): Promise<Float32Array[]>;
  embedPassages(texts: string[]): Promise<Float32Array[]>;
}

export interface DenseIndex { chunks: ReviewChunk[]; vectors: Float32Array[] }

export function buildDenseIndex(chunks: ReviewChunk[], vectorsById: Map<string, Float32Array>): DenseIndex {
  const kept = chunks.filter((chunk) => vectorsById.has(chunk.id));
  return { chunks: kept, vectors: kept.map((chunk) => vectorsById.get(chunk.id)!) };
}

/** Text a passage is embedded from: the heading says what the section is about. */
export const passageText = (chunk: ReviewChunk) => `${chunk.heading}\n${chunk.text}`;

/** Cosine similarity for normalized vectors (dot product). */
export function dot(left: Float32Array, right: Float32Array): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += left[index]! * right[index]!;
  return sum;
}

export function retrieveDense(index: DenseIndex, query: Float32Array, options: { slugs?: string[]; kinds?: SectionKind[]; limit?: number } = {}): RetrievedChunk[] {
  const slugs = options.slugs ? new Set(options.slugs) : null;
  const kinds = options.kinds ? new Set(options.kinds) : null;
  const results: RetrievedChunk[] = [];
  index.chunks.forEach((chunk, position) => {
    if (slugs && !slugs.has(chunk.slug)) return;
    if (kinds && !kinds.has(chunk.kind)) return;
    results.push({ chunk, score: dot(query, index.vectors[position]!) });
  });
  results.sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id));
  return results.slice(0, options.limit ?? 5);
}

/**
 * Reciprocal Rank Fusion: a chunk at rank r (1-based) in a list contributes weight / (k + r).
 * Ranks, not raw scores, because BM25 and cosine scores live on incomparable scales. k = 60 is the
 * standard constant that damps the gap between neighbouring ranks.
 */
export function fuseRrf(lists: RetrievedChunk[][], options: { k?: number; weights?: number[]; limit?: number } = {}): RetrievedChunk[] {
  const k = options.k ?? 60;
  const fused = new Map<string, RetrievedChunk>();
  lists.forEach((list, listIndex) => {
    const weight = options.weights?.[listIndex] ?? 1;
    list.forEach((result, rank) => {
      const current = fused.get(result.chunk.id);
      const contribution = weight / (k + rank + 1);
      fused.set(result.chunk.id, { chunk: result.chunk, score: (current?.score ?? 0) + contribution });
    });
  });
  return [...fused.values()].sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id)).slice(0, options.limit ?? 5);
}

export interface HybridOptions extends RetrieveOptions { slugs: string[]; pool?: number; weights?: [lexical: number, dense: number] }

/** Hybrid retrieval per resolved racket (BM25 + vectors, fused by RRF), interleaved across rackets. */
export function retrieveHybrid(lexical: LexicalIndex, dense: DenseIndex, query: string, queryVector: Float32Array, options: HybridOptions): RetrievedChunk[] {
  const limit = options.limit ?? 5;
  const pool = options.pool ?? 50;
  const perSlug = Math.ceil(limit / options.slugs.length);
  const lists = options.slugs.map((slug) => fuseRrf([
    retrieveLexical(lexical, query, { ...options, slugs: [slug], limit: pool }),
    retrieveDense(dense, queryVector, { slugs: [slug], kinds: options.kinds, limit: pool }),
  ], { weights: options.weights, limit: perSlug }));
  const merged: RetrievedChunk[] = [];
  for (let rank = 0; rank < perSlug; rank += 1) for (const list of lists) if (list[rank]) merged.push(list[rank]!);
  return merged.slice(0, limit);
}
