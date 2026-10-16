import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { matchReviewDir, pairKey, parseCandidates, readReviewState, recordAnswer } = await import('../../apps/web/lib/match-review');

const candidates = { version: 1, releaseId: 'release-a', candidates: [{ left: { id: 'b' }, right: { id: 'a' }, score: 1, confidence: 'high', reasons: ['same_brand'], ambiguous: false }], yearMismatches: [[{ id: 'c' }, { id: 'd' }]] };
const dir = () => { const path = mkdtempSync(join(tmpdir(), 'match-review-')); writeFileSync(join(path, 'match-candidates.json'), JSON.stringify(candidates)); return path; };

describe('match review (R6, dev-only, file-based)', () => {
  it('is enabled only in development with an explicit directory', () => {
    expect(matchReviewDir({ APP_ENV: 'production', MATCH_REVIEW_DIR: '/x' })).toBeNull();
    expect(matchReviewDir({ APP_ENV: 'development' })).toBeNull();
    expect(matchReviewDir({ APP_ENV: 'development', MATCH_REVIEW_DIR: '/x', INIT_CWD: '/' })).toMatch(/x$/);
  });
  it('parses candidates with an order-independent pair key and rejects malformed files', () => {
    const parsed = parseCandidates(JSON.stringify(candidates));
    expect(parsed.candidates[0]).toMatchObject({ key: pairKey('a', 'b'), leftId: 'b', rightId: 'a', confidence: 'high' });
    expect(parsed.yearMismatches).toEqual([{ leftId: 'c', rightId: 'd' }]);
    for (const bad of ['{}', JSON.stringify({ ...candidates, version: 2 }), JSON.stringify({ ...candidates, candidates: [{ left: {}, right: { id: 'a' } }] })]) expect(() => parseCandidates(bad)).toThrow('CANDIDATES_INVALID');
  });
  it('records, replaces and keeps answers for the same release only', async () => {
    const path = dir();
    expect((await readReviewState(path)).answers).toEqual({});
    await recordAnswer(path, pairKey('a', 'b'), 'same');
    await recordAnswer(path, pairKey('a', 'b'), 'unsure');
    expect((await readReviewState(path)).answers[pairKey('a', 'b')]?.answer).toBe('unsure');
    expect(JSON.parse(readFileSync(join(path, 'match-decisions.json'), 'utf8')).releaseId).toBe('release-a');
    writeFileSync(join(path, 'match-candidates.json'), JSON.stringify({ ...candidates, releaseId: 'release-b' }));
    expect((await readReviewState(path)).answers).toEqual({});
  });
  it('rejects unknown pairs and answers', async () => {
    const path = dir();
    await expect(recordAnswer(path, 'x~y', 'same')).rejects.toThrow('CANDIDATE_UNKNOWN');
    await expect(recordAnswer(path, pairKey('a', 'b'), 'maybe')).rejects.toThrow('ANSWER_INVALID');
  });
});
