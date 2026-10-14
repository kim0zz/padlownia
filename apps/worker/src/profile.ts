import { normalizeRecord, parseSnapshot, NORMALIZER_VERSION, type ParsedSnapshot, type SourceCode } from '@padlownia/domain';
import { sha256 } from './storage.js';

export function profileSnapshot(source: SourceCode, bytes: Uint8Array) {
  const parsed = parseSnapshot(source, bytes);
  const records = parsed.records.map(normalizeRecord);
  const issueCounts: Record<string, number> = {};
  for (const issue of [...parsed.issues, ...parsed.recordErrors.flatMap((r) => r.issues), ...records.flatMap((r) => [...r.issues, ...r.observations.flatMap((o) => o.issues), ...r.ratings.flatMap((rating) => rating.issues)])]) issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
  const summary = {
    source, sha256: sha256(bytes), parserVersion: parsed.parserVersion, normalizerVersion: NORMALIZER_VERSION,
    declaredCount: parsed.declaredCount, actualCount: parsed.actualCount,
    parsedCount: records.length, invalidCount: parsed.recordErrors.length + records.filter((r) => r.status === 'invalid').length,
    reviewRequiredCount: records.filter((r) => r.status === 'needs_review').length,
    validCount: records.filter((r) => r.status === 'valid').length,
    sourceRowsDenominator: parsed.actualCount, issueCounts, paidLlmCalls: 0,
  };
  return { parsed, records, summary };
}
export function snapshotIssues(parsed: ParsedSnapshot): string[] {
  return [...new Set(parsed.issues.map((issue) => issue.code))];
}
