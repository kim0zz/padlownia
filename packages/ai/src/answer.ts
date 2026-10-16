import { z } from 'zod';

/**
 * What the assistant model is allowed to return (P-005, P-011). The model never writes UI or URLs:
 * it returns racket IDs for existing components and short text segments, each labelled with what
 * kind of statement it is and which evidence it rests on. The server checks all of it before rendering.
 */
export const ANSWER_CONTRACT_VERSION = 1;
const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const SEGMENT_KINDS = ['spec_fact', 'source_opinion', 'ai_inference', 'uncertainty'] as const;
export const answerSchema = z.strictObject({
  version: z.literal(ANSWER_CONTRACT_VERSION),
  intent: z.enum(['lookup', 'search', 'stats', 'compare', 'follow_up', 'clarify', 'out_of_scope']),
  /** Rackets the answer is about, in display order. Must come from the resolved candidates. */
  rackets: z.array(id).max(6),
  segments: z.array(z.strictObject({
    kind: z.enum(SEGMENT_KINDS),
    text: z.string().min(1).max(600),
    /** Chunk IDs (review evidence) or spec observation IDs this segment rests on. */
    citations: z.array(id).max(8),
  })).max(12),
  /** When the question is ambiguous (year, variant, 12K/18K…): ask, offering only known IDs. */
  clarification: z.strictObject({ question: z.string().min(1).max(300), options: z.array(id).min(2).max(6) }).optional(),
});
export type AssistantAnswer = z.infer<typeof answerSchema>;

export interface AnswerContext {
  /** Racket IDs the resolver produced for this turn (and the conversation's selected rackets). */
  allowedRackets: string[];
  /** Everything the model was shown, by ID, with its exact text — the only things it may cite. */
  evidence: Map<string, string>;
  /** Text whose numbers are always fine to repeat, e.g. display names ("AT10 18K 2026"). */
  namesText?: string;
}

export type AnswerViolation =
  | { code: 'invalid_shape' }
  | { code: 'unknown_racket'; racket: string }
  | { code: 'unknown_citation'; segment: number; citation: string }
  | { code: 'missing_citation'; segment: number }
  | { code: 'ungrounded_number'; segment: number; number: string }
  | { code: 'long_quote'; segment: number }
  | { code: 'clarification_without_intent' };

const NUMBER = /\d+(?:[.,]\d+)?/g;
const normalizeNumber = (value: string) => value.replace(',', '.').replace(/\.0+$/, '');
/** Permission O-002 covers short attributed quotations only. */
export const MAX_QUOTE_WORDS = 25;

/**
 * Deterministic checks that catch the most damaging failures without another model call:
 * citing evidence that was never shown, statements without sources, numbers that appear in no cited
 * evidence (invented weights, scores, prices) and over-long quotations.
 */
export function validateAnswer(input: unknown, context: AnswerContext): { ok: true; answer: AssistantAnswer; violations: [] } | { ok: false; violations: AnswerViolation[] } {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, violations: [{ code: 'invalid_shape' }] };
  const answer = parsed.data;
  const violations: AnswerViolation[] = [];
  const allowed = new Set(context.allowedRackets);
  for (const racket of [...answer.rackets, ...(answer.clarification?.options ?? [])]) {
    if (!allowed.has(racket)) violations.push({ code: 'unknown_racket', racket });
  }
  if (answer.clarification && answer.intent !== 'clarify') violations.push({ code: 'clarification_without_intent' });

  answer.segments.forEach((segment, index) => {
    const cited = segment.citations.map((citation) => {
      const text = context.evidence.get(citation);
      if (text === undefined) violations.push({ code: 'unknown_citation', segment: index, citation });
      return text ?? '';
    });
    // "Uncertainty" may state that evidence is missing; everything else must rest on something.
    if (segment.kind !== 'uncertainty' && !segment.citations.length) violations.push({ code: 'missing_citation', segment: index });
    const evidenceNumbers = new Set(`${cited.join(' ')} ${context.namesText ?? ''}`.match(NUMBER)?.map(normalizeNumber) ?? []);
    for (const number of segment.text.match(NUMBER) ?? []) {
      if (!evidenceNumbers.has(normalizeNumber(number))) violations.push({ code: 'ungrounded_number', segment: index, number });
    }
    for (const quote of segment.text.match(/[„"“«]([^"”»]+)["”»]/g) ?? []) {
      if (quote.split(/\s+/).length > MAX_QUOTE_WORDS) violations.push({ code: 'long_quote', segment: index });
    }
  });
  return violations.length ? { ok: false, violations } : { ok: true, answer, violations: [] };
}
