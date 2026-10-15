export const CONTRACT_VERSION = "1.0.0";
export const PARSER_VERSION = "1.3.0";
export const NORMALIZER_VERSION = "1.3.0";
export const MATCH_RULE_VERSION = "exact-identity-v1";

export type SourceCode = "padeltrue" | "padelhow";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ClaimType = "manufacturer_declared" | "retailer_claim" | "measured_specimen" | "editorial_assessment" | "unknown";
export type RatingKind = "editorial" | "rule_derived" | "measured" | "unknown";
export type ValidationStatus = "valid" | "unknown" | "invalid";
export interface Issue { code: string; path: string; severity: "error" | "warning" }
export interface SourceIdentity { brand: string; name: string; year: number | null; variant?: string }
export interface NormalizedIdentity extends SourceIdentity {
  brandKey: string;
  modelKey: string;
  variantKey: string;
  identityKey: string;
  issues: Issue[];
}
export interface SourceAttribution { name: string | null; url: string | null; verified: boolean }
export interface ObservationInput {
  key: string;
  rawValue: Json;
  rawSourcePath: string;
  kind: ClaimType;
  context: Record<string, Json>;
  attribution: SourceAttribution | null;
}
export interface SourceRating {
  key: string;
  rawValue: Json;
  rawSourcePath: string;
  numericScore: number | null;
  scaleMin: number | null;
  scaleMax: number | null;
  methodology: string;
  kind: RatingKind;
  status: ValidationStatus;
  issues: Issue[];
}
export interface SourceRecord {
  contractVersion: string;
  source: SourceCode;
  inputIndex: number;
  externalId: string;
  externalIdScope: "source" | "snapshot";
  sourceUrl: string | null;
  identity: SourceIdentity;
  observations: ObservationInput[];
  ratings: SourceRating[];
  metadata: Record<string, Json>;
  rawPayload: Json;
  issues: Issue[];
}
export interface RecordError {
  inputIndex: number;
  externalId: string;
  rawPayload: Json;
  issues: Issue[];
}
export interface ParsedSnapshot {
  source: SourceCode;
  parserVersion: string;
  declaredCount: number | null;
  actualCount: number;
  records: SourceRecord[];
  recordErrors: RecordError[];
  issues: Issue[];
  metadata: Record<string, Json>;
}
export interface NormalizedObservation extends ObservationInput {
  status: ValidationStatus;
  normalizedText: string | null;
  numericValue: number | null;
  valueMin: number | null;
  valueMax: number | null;
  unit: string | null;
  issues: Issue[];
}
export interface NormalizedRecord extends Omit<SourceRecord, "identity" | "observations"> {
  identity: NormalizedIdentity;
  observations: NormalizedObservation[];
  status: "valid" | "needs_review" | "invalid";
  normalizerVersion: string;
}
export interface IdentityCandidate { id: string; identity: NormalizedIdentity }
export interface MatchDecision {
  decision: "auto_accepted" | "new_identity" | "needs_review";
  racketId: string | null;
  candidateIds: string[];
  reasonCodes: string[];
  ruleVersion: string;
}
export interface AttributedObservation extends NormalizedObservation {
  id: string;
  source: SourceCode;
  sourceUrl: string | null;
  externalId: string;
}
export interface ProjectionSelection {
  selected: Record<string, AttributedObservation>;
  conflicts: string[];
  unknown: string[];
}
export class SnapshotError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "SnapshotError"; }
}
