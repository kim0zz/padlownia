import { z } from 'zod';
import { SECTION_KINDS, type SectionKind } from './chunking';
import type { RetrievedChunk } from './lexical';

/**
 * Retrieval golden set. Expectations name a racket and the section kinds that answer the question,
 * not exact chunk IDs, so the set survives re-chunking. Questions are owner-language (Polish).
 */
export const retrievalCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  question: z.string().min(5).max(500),
  /** Slugs the question resolves to (what a resolver should produce). Retrieval is scoped to them. */
  scope: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(4),
  /** Any top-k chunk of one of these slugs with one of these kinds counts as a hit. */
  expected: z.array(z.strictObject({ slug: z.string(), kinds: z.array(z.enum(SECTION_KINDS)).min(1) })).min(1),
  tags: z.array(z.string()).default([]),
});
export type RetrievalCase = z.infer<typeof retrievalCaseSchema>;

export function parseGoldenJsonl(text: string): RetrievalCase[] {
  const cases = text.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('//'))
    .map((line, index) => {
      const parsed = retrievalCaseSchema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`GOLDEN_CASE_INVALID line ${index + 1}: ${parsed.error.issues[0]?.message}`);
      return parsed.data;
    });
  const ids = new Set(cases.map((item) => item.id));
  if (ids.size !== cases.length) throw new Error('GOLDEN_CASE_DUPLICATE_ID');
  return cases;
}

const matches = (result: RetrievedChunk, item: RetrievalCase['expected'][number]) =>
  item.slug === result.chunk.slug && item.kinds.includes(result.chunk.kind as SectionKind);

export interface CaseResult { id: string; firstHitRank: number | null; tags: string[] }
export interface RetrievalMetrics { cases: number; hitAt1: number; hitAt3: number; hitAt5: number; hitAt20: number; mrr: number }

/**
 * Rank at which the case is fully answered: every expected racket has a matching chunk at or above it.
 * A comparison that retrieves evidence for only one side is a miss.
 */
export function scoreCase(item: RetrievalCase, results: RetrievedChunk[]): CaseResult {
  const ranks = item.expected.map((expected) => results.findIndex((result) => matches(result, expected)));
  const covered = ranks.every((rank) => rank >= 0);
  return { id: item.id, firstHitRank: covered ? Math.max(...ranks) + 1 : null, tags: item.tags };
}

export function summarize(results: CaseResult[]): RetrievalMetrics {
  const share = (k: number) => results.filter((result) => result.firstHitRank !== null && result.firstHitRank <= k).length / Math.max(1, results.length);
  const mrr = results.reduce((sum, result) => sum + (result.firstHitRank ? 1 / result.firstHitRank : 0), 0) / Math.max(1, results.length);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { cases: results.length, hitAt1: round(share(1)), hitAt3: round(share(3)), hitAt5: round(share(5)), hitAt20: round(share(20)), mrr: round(mrr) };
}
