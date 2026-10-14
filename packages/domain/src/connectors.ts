import { CONTRACT_VERSION, PARSER_VERSION, SnapshotError, type ClaimType, type Issue, type Json, type ObservationInput, type ParsedSnapshot, type SourceCode, type SourceRating, type SourceRecord } from "./types.js";

type ObjectValue = { [key: string]: Json };
const object = (value: Json | undefined): ObjectValue | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
const text = (value: Json | undefined): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const pointer = (key: string): string => key.replaceAll("~", "~0").replaceAll("/", "~1");
const issue = (code: string, path: string, severity: Issue["severity"] = "error"): Issue => ({ code, path, severity });
export function safeSourceUrl(value: Json | undefined): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

const attributeKeys: Record<string, string> = {
  weight_g: "weight", weight: "weight", balance_cm: "balance", balance: "balance",
  thickness_mm: "thickness", thickness: "thickness", shape: "shape", core: "core",
  core_material: "core", surface: "surface", surface_material: "surface", face: "surface",
  player_level: "player_level", level: "player_level", texture: "texture",
};
const claims = new Set<ClaimType>(["manufacturer_declared", "retailer_claim", "measured_specimen", "editorial_assessment", "unknown"]);

function observation(key: string, raw: Json, path: string): ObservationInput {
  const nested = object(raw);
  const wrapped = nested && Object.hasOwn(nested, "value") ? nested : null;
  const attribution = object(wrapped?.source);
  const explicitKind = text(wrapped?.claim_type) as ClaimType | null;
  const declaredSourceType = text(attribution?.type);
  const kind: ClaimType = explicitKind && claims.has(explicitKind) ? explicitKind
    : declaredSourceType === "manufacturer" ? "manufacturer_declared"
      : declaredSourceType === "retailer" ? "retailer_claim" : "unknown";
  const sourceUrl = safeSourceUrl(attribution?.url);
  const context = { ...(object(wrapped?.context) ?? {}) };
  if (text(wrapped?.unit)) context.unit = wrapped!.unit!;
  if (text(wrapped?.reference_point)) context.referencePoint = wrapped!.reference_point!;
  // A supplier's `verified` flag is preserved in raw payload, but cannot certify itself.
  // Verification of manufacturer provenance is a separate explicit review action.
  return {
    key: Object.hasOwn(attributeKeys, key) ? attributeKeys[key]! : key, rawValue: wrapped ? wrapped.value! : raw,
    rawSourcePath: wrapped ? `${path}/value` : path, kind, context,
    attribution: attribution ? { name: text(attribution.name), url: sourceUrl, verified: false } : null,
  };
}

function rating(key: string, raw: Json, path: string, source: SourceCode, overall: boolean, metadata: ObjectValue): SourceRating {
  const nested = object(raw);
  const value = nested && Object.hasOwn(nested, "value") ? nested.value! : raw;
  const sourceScale = object(nested?.scale) ?? object(metadata.rating_scale);
  const scaleMin = source === "padelhow" ? 0 : typeof sourceScale?.min === "number" ? sourceScale.min : null;
  const scaleMax = source === "padelhow" ? overall ? 100 : 10 : typeof sourceScale?.max === "number" ? sourceScale.max : null;
  const score = typeof value === "number" && Number.isFinite(value) ? value : null;
  const issues: Issue[] = [];
  if (score === null) issues.push(issue(value === null ? "missing_rating" : "invalid_rating", path, value === null ? "warning" : "error"));
  if (scaleMin === null || scaleMax === null || scaleMin >= scaleMax) issues.push(issue("unknown_rating_scale", path, "warning"));
  if (score !== null && scaleMin !== null && scaleMax !== null && (score < scaleMin || score > scaleMax)) issues.push(issue("rating_out_of_range", path));
  return {
    key, rawValue: value, rawSourcePath: nested && Object.hasOwn(nested, "value") ? `${path}/value` : path,
    numericScore: issues.some((x) => x.severity === "error") ? null : score, scaleMin, scaleMax,
    methodology: text(nested?.methodology) ?? text(metadata.methodology) ?? (source === "padeltrue" ? "padeltrue:technical-characteristics:version-unknown" : "padelhow:editorial:version-unknown"),
    kind: source === "padeltrue" ? "rule_derived" : "editorial",
    status: issues.some((x) => x.severity === "error") ? "invalid" : issues.length ? "unknown" : "valid", issues,
  };
}

function parseRecord(raw: Json, inputIndex: number, source: SourceCode, rootPath: string, metadata: ObjectValue): SourceRecord | { issues: Issue[] } {
  const row = object(raw);
  const path = `${rootPath}/${inputIndex}`;
  if (!row) return { issues: [issue("record_must_be_object", path)] };
  const brand = text(row.brand);
  const name = text(row.name) ?? text(row.model);
  const rawId = row.id ?? row.slug;
  const externalId = text(rawId) ?? (typeof rawId === "number" && Number.isSafeInteger(rawId) ? String(rawId) : `snapshot-row:${inputIndex}`);
  const issues: Issue[] = [];
  if (!brand) issues.push(issue("missing_brand", `${path}/brand`));
  if (!name) issues.push(issue("missing_model", `${path}/name`));
  const yearRaw = row.year ?? row.model_year ?? null;
  const year = typeof yearRaw === "number" && Number.isInteger(yearRaw) && yearRaw >= 1990 && yearRaw <= 2100 ? yearRaw : null;
  if (yearRaw !== null && year === null) issues.push(issue("invalid_year", `${path}/year`));
  if (!brand || !name || issues.some((x) => x.code === "invalid_year")) return { issues };
  const externalIdScope = externalId.startsWith("snapshot-row:") ? "snapshot" : "source";
  if (externalIdScope === "snapshot") issues.push(issue("missing_external_id", path, "warning"));
  if (year === null) issues.push(issue("unknown_year", `${path}/year`, "warning"));
  const specField = source === "padeltrue" ? (row.specs ? "specs" : "specifications") : "characteristics";
  const specs = object(row[specField]);
  if (!specs) issues.push(issue(source === "padelhow" ? "detailed_characteristics_required" : "specifications_required", `${path}/${specField}`));
  const observations = specs ? Object.entries(specs).map(([key, value]) => observation(key, value, `${path}/${specField}/${pointer(key)}`)) : [];
  const scoreField = source === "padeltrue" ? "scores" : "ratings";
  const scores = object(row[scoreField]);
  const ratings = scores ? Object.entries(scores).map(([key, value]) => rating(key, value, `${path}/${scoreField}/${pointer(key)}`, source, key === "overall", metadata)) : [];
  if (row.overall_score !== undefined) ratings.push(rating("overall", row.overall_score, `${path}/overall_score`, source, true, metadata));
  const sourceUrl = safeSourceUrl(row.url ?? row.product_url);
  if ((row.url ?? row.product_url) != null && !sourceUrl) issues.push(issue("invalid_source_url", `${path}/url`));
  const preservedMetadata: Record<string, Json> = {};
  for (const key of ["markdown_url", "json_url", "image", "offers", "price", "currency", "updated_at", "metadata", "conflicts"]) {
    if (row[key] !== undefined) preservedMetadata[key] = row[key]!;
  }
  return { contractVersion: CONTRACT_VERSION, source, inputIndex, externalId, externalIdScope, sourceUrl,
    identity: { brand, name, year, ...(text(row.variant) ? { variant: text(row.variant)! } : {}) },
    observations, ratings, metadata: preservedMetadata, rawPayload: raw, issues };
}

/** Offline parser. Supported fixture schema is documented in packages/domain/README.md.
 * Unsupported envelopes fail closed; per-row errors preserve originals without echoing them in logs. */
export function parseSnapshot(source: SourceCode, input: string | Uint8Array): ParsedSnapshot {
  if (source !== "padeltrue" && source !== "padelhow") throw new SnapshotError("unsupported_source");
  let parsed: Json;
  try { parsed = JSON.parse(typeof input === "string" ? input.replace(/^\uFEFF/, "") : new TextDecoder("utf-8", { fatal: true }).decode(input).replace(/^\uFEFF/, "")) as Json; }
  catch { throw new SnapshotError("invalid_json"); }
  const envelope = object(parsed);
  const rawRows = Array.isArray(parsed) ? parsed : envelope?.rackets;
  if (!Array.isArray(rawRows)) throw new SnapshotError("unsupported_snapshot_envelope");
  const metadata = object(envelope?.metadata) ?? {};
  const rawCount = envelope?.count ?? metadata.count ?? envelope?.total ?? null;
  if (rawCount !== null && (typeof rawCount !== "number" || !Number.isSafeInteger(rawCount) || rawCount < 0)) throw new SnapshotError("invalid_declared_count");
  const declaredCount = rawCount as number | null;
  const result: ParsedSnapshot = { source, parserVersion: PARSER_VERSION, declaredCount, actualCount: rawRows.length, records: [], recordErrors: [], issues: [], metadata };
  const ids = new Map<string, number[]>();
  rawRows.forEach((raw, inputIndex) => {
    const record = parseRecord(raw, inputIndex, source, Array.isArray(parsed) ? "" : "/rackets", metadata);
    if (!("identity" in record)) { result.recordErrors.push({ inputIndex, externalId: `snapshot-row:${inputIndex}`, rawPayload: raw, issues: record.issues }); return; }
    result.records.push(record);
    const sameId = ids.get(record.externalId) ?? [];
    sameId.push(inputIndex); ids.set(record.externalId, sameId);
  });
  for (const record of result.records) {
    if ((ids.get(record.externalId)?.length ?? 0) > 1) record.issues.push(issue("duplicate_external_id", `/rackets/${record.inputIndex}`));
  }
  if (declaredCount !== null && declaredCount !== rawRows.length) result.issues.push(issue("source_count_mismatch", "/count"));
  if (!rawRows.length) result.issues.push(issue("empty_snapshot", "/rackets"));
  return result;
}

export const padelTrueConnector = { sourceCode: "padeltrue" as const, parse: (input: string | Uint8Array) => parseSnapshot("padeltrue", input) };
export const padelHowConnector = { sourceCode: "padelhow" as const, parse: (input: string | Uint8Array) => parseSnapshot("padelhow", input) };
