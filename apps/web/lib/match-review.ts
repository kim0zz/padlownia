import 'server-only';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Dev-only review of cross-source match candidates (ROADMAP R6). Reads the candidates file made by
 * `npm run candidates` and records the owner's answers in a local JSON file next to it. Never writes to the database:
 * a release script turns accepted answers into source review decisions (P-008).
 */
export type MatchAnswer = 'same' | 'different' | 'unsure';
export interface ReviewCandidate { key: string; leftId: string; rightId: string; score: number; confidence: 'high' | 'medium'; reasons: string[]; ambiguous: boolean }
export interface ReviewState { releaseId: string; candidates: ReviewCandidate[]; yearMismatches: { leftId: string; rightId: string }[]; answers: Record<string, { answer: MatchAnswer; at: string }> }

const ANSWERS: readonly MatchAnswer[] = ['same', 'different', 'unsure'];
export const pairKey = (leftId: string, rightId: string) => [leftId, rightId].sort().join('~');

export function matchReviewDir(env: Record<string, string | undefined> = process.env): string | null {
  if (env.APP_ENV !== 'development' || !env.MATCH_REVIEW_DIR?.trim()) return null;
  return resolve(env.INIT_CWD ?? process.cwd(), env.MATCH_REVIEW_DIR.trim());
}

type RawSide = { id?: unknown };
type RawCandidate = { left?: RawSide; right?: RawSide; score?: unknown; confidence?: unknown; reasons?: unknown; ambiguous?: unknown };

export function parseCandidates(text: string): Omit<ReviewState, 'answers'> {
  const data = JSON.parse(text) as { version?: unknown; releaseId?: unknown; candidates?: RawCandidate[]; yearMismatches?: [RawSide, RawSide][] };
  if (data.version !== 1 || typeof data.releaseId !== 'string' || !Array.isArray(data.candidates)) throw new Error('CANDIDATES_INVALID');
  const id = (side: RawSide | undefined) => { if (typeof side?.id !== 'string' || !side.id) throw new Error('CANDIDATES_INVALID'); return side.id; };
  const candidates = data.candidates.map((c) => ({ key: pairKey(id(c.left), id(c.right)), leftId: id(c.left), rightId: id(c.right), score: Number(c.score),
    confidence: c.confidence === 'high' ? 'high' as const : 'medium' as const, reasons: Array.isArray(c.reasons) ? c.reasons.filter((r): r is string => typeof r === 'string') : [], ambiguous: c.ambiguous === true }));
  const yearMismatches = (data.yearMismatches ?? []).map(([l, r]) => ({ leftId: id(l), rightId: id(r) }));
  return { releaseId: data.releaseId, candidates, yearMismatches };
}

export async function readReviewState(dir: string): Promise<ReviewState> {
  const base = parseCandidates(await readFile(resolve(dir, 'match-candidates.json'), 'utf8'));
  let answers: ReviewState['answers'] = {};
  try {
    const stored = JSON.parse(await readFile(resolve(dir, 'match-decisions.json'), 'utf8')) as { releaseId?: string; answers?: ReviewState['answers'] };
    if (stored.releaseId === base.releaseId && stored.answers) answers = stored.answers;
  } catch { /* No answers yet. */ }
  return { ...base, answers };
}

/** Records one answer for a known candidate; unknown pairs and answers are rejected. Atomic replace of the file. */
export async function recordAnswer(dir: string, key: string, answer: string): Promise<void> {
  if (!ANSWERS.includes(answer as MatchAnswer)) throw new Error('ANSWER_INVALID');
  const state = await readReviewState(dir);
  if (!state.candidates.some((candidate) => candidate.key === key)) throw new Error('CANDIDATE_UNKNOWN');
  const answers = { ...state.answers, [key]: { answer: answer as MatchAnswer, at: new Date().toISOString() } };
  const file = resolve(dir, 'match-decisions.json');
  await writeFile(`${file}.tmp`, JSON.stringify({ version: 1, releaseId: state.releaseId, answers }, null, 1));
  await rename(`${file}.tmp`, file);
}
