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
const padelHowCategories = ["maneuverability", "net_performance", "control", "defensive_output", "off_center_stability", "sweet_spot", "spin_generation", "power_ceiling", "power_accessibility", "comfort"];
const flatSpecKeys: Record<string, string> = { shape: "shape", thickness_mm: "thickness", weight_g: "weight", balance_cm: "balance", face_material: "surface", core: "core", surface: "texture", player_level: "player_level" };
const padelTrueCategories = ["power", "control", "handling", "forgiveness", "comfort", "value"];

/** Keep the cited verbatim statement and the supplier's structured interpretation separately. */
function trueObservations(key: string, raw: Json, path: string): ObservationInput[] {
  const spec = object(raw);
  if (!spec) return [observation(key, raw, path)];
  const context: Record<string, Json> = { sourceFormat: "padeltrue:model-1.0", sourceField: key, sourceDisplay: spec.display ?? null, sourceDisplayPath: `${path}/display` };
  if (spec.checkedOn !== undefined) context.checkedOn = spec.checkedOn;
  const kind: ClaimType = spec.sourceType === "manufacturer" ? "manufacturer_declared" : spec.sourceType === "retailer" ? "retailer_claim" : "unknown";
  const base: ObservationInput = { key: key === "thicknessMm" ? "thickness" : key === "roughSurface" ? "texture" : key,
    rawValue: spec.verbatim ?? raw, rawSourcePath: spec.verbatim !== undefined ? `${path}/verbatim` : path, kind, context,
    attribution: { name: null, url: safeSourceUrl(spec.source), verified: false } };
  const candidate = (value: Json, fields: string[]) => { context.normalizationCandidate = value; context.normalizationCandidatePaths = fields.map((field) => `${path}/${field}`); };
  if (key === "weight") {
    if (typeof spec.min === "number" && typeof spec.max === "number") {
      candidate(`${spec.min}–${spec.max}`, ["min", "max"]);
      // Model 1.0's published input contract explicitly defines these limits in grams.
      context.unit = "g"; context.unitEvidenceUrl = "https://padeltrue.com/methodology";
    }
  } else if (key === "balance") {
    context.sourceMillimeters = spec.mm ?? null; context.sourceCentimeters = spec.cm ?? null;
    if (typeof spec.value === "string") candidate(spec.value, ["value"]);
    else if (typeof spec.mm === "number" && typeof spec.display === "string" && /\bmm\b/i.test(spec.display)) { candidate(spec.mm, ["mm"]); context.unit = "mm"; }
    else if (typeof spec.cm === "number" && typeof spec.display === "string" && /\bcm\b/i.test(spec.display)) { candidate(spec.cm, ["cm"]); context.unit = "cm"; }
    // No measurement reference/configuration is supplied: numeric balance stays unknown.
  } else if (key === "core" || key === "surface" || key === "frame") candidate(spec.material ?? null, ["material"]);
  else if (key === "roughSurface" && typeof spec.value === "boolean") candidate(spec.value ? "rough" : "not_rough", ["value"]);
  else if (spec.value !== undefined) candidate(spec.value, ["value"]);
  if (key === "thicknessMm" && typeof spec.display === "string" && /\bmm\b/i.test(spec.display)) { context.unit = "mm"; context.unitEvidencePath = `${path}/display`; }
  const observations = [base];
  if (key === "core" && typeof spec.value === "string") observations.push({ ...base, key: "firmness", context: { ...context, normalizationCandidate: spec.value, normalizationCandidatePaths: [`${path}/value`] } });
  return observations;
}

/** Explicit definitions in the supplied versioned source schema establish units, not key suffixes. */
function flatObservation(key: string, raw: Json, path: string, metadata: ObjectValue): ObservationInput {
  const result = observation(flatSpecKeys[key]!, raw, path);
  const definition = text(object(metadata.fields)?.[key]);
  result.context.sourceField = key;
  result.context.sourceSchemaVersion = metadata.schema_version!;
  if (definition) {
    result.context.sourceFieldDefinition = definition;
    result.context.sourceSchemaPath = `/fields/${pointer(key)}`;
    // Match the inspected definitions exactly; a changed/negated description needs review.
    if (key === "weight_g" && definition === "Unstrung weight range in grams.") result.context.unit = "g";
    if (key === "thickness_mm" && definition === "Profile thickness in millimetres.") result.context.unit = "mm";
    if (key === "balance_cm" && definition === "Balance point in centimetres from the butt.") { result.context.unit = "cm"; result.context.referencePoint = "butt"; }
    if (key === "shape" && definition === "Head shape as measured on the frame.") result.kind = "measured_specimen";
  }
  if (typeof raw === "string" && /\b(?:as tested|test unit|field testing|measured)\b/i.test(raw)) result.kind = "measured_specimen";
  return result;
}

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

function parseRecord(raw: Json, inputIndex: number, source: SourceCode, rootPath: string, metadata: ObjectValue, flatPadelHow: boolean, publishedPadelTrue: boolean): SourceRecord | { issues: Issue[] } {
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
  if (!flatPadelHow && !specs) issues.push(issue(source === "padelhow" ? "detailed_characteristics_required" : "specifications_required", `${path}/${specField}`));
  if (flatPadelHow && !Object.keys(flatSpecKeys).every((key) => Object.hasOwn(row, key))) issues.push(issue("detailed_characteristics_required", path));
  const observations = flatPadelHow ? Object.entries(flatSpecKeys).filter(([key]) => Object.hasOwn(row, key)).map(([key]) => flatObservation(key, row[key]!, `${path}/${key}`, metadata))
    : publishedPadelTrue && specs ? Object.entries(specs).filter(([key]) => key !== "price").flatMap(([key, value]) => trueObservations(key, value, `${path}/${specField}/${pointer(key)}`))
    : specs ? Object.entries(specs).map(([key, value]) => observation(key, value, `${path}/${specField}/${pointer(key)}`)) : [];
  if (publishedPadelTrue) for (const [sourceKey, rawConflict] of Object.entries(object(row.inputConflicts) ?? {})) {
    const conflict = object(rawConflict);
    if (!conflict) continue;
    // PadelTrue's model input named `core` is firmness, separate from foam material.
    const key = sourceKey === "core" ? "firmness" : sourceKey;
    for (const existing of observations.filter(value => value.key === key)) existing.context.sourceConflict = rawConflict;
    observations.push({ key,rawValue: conflict.verbatim ?? rawConflict,rawSourcePath: `${path}/inputConflicts/${pointer(sourceKey)}${conflict.verbatim !== undefined ? "/verbatim" : ""}`,
      kind: "unknown",context: { sourceConflict: rawConflict,sourceConflictField: sourceKey },attribution: { name: null,url: safeSourceUrl(conflict.source),verified: false } });
  }
  const scoreField = publishedPadelTrue ? "ratings" : source === "padeltrue" || flatPadelHow ? "scores" : "ratings";
  const scores = object(row[scoreField]);
  const ratings = scores ? Object.entries(scores).map(([key, value]) => rating(key, value, `${path}/${scoreField}/${pointer(key)}`, source, key === "overall", metadata)) : [];
  if (flatPadelHow) {
    ratings.push(rating("overall", row.score ?? null, `${path}/score`, source, true, metadata));
    const scoreKeys = Object.keys(scores ?? {});
    if (scoreKeys.length !== padelHowCategories.length || padelHowCategories.some((key) => !Object.hasOwn(scores ?? {}, key))) issues.push(issue("rating_category_set_mismatch", `${path}/scores`));
    // The supplied llms.txt documents a rounded sum; retain the original total, never repair it.
    const categoryValues = padelHowCategories.map((key) => scores?.[key]);
    if (categoryValues.every((value) => typeof value === "number" && Number.isFinite(value)) && typeof row.score === "number" && Math.round(categoryValues.reduce<number>((sum, value) => sum + (value as number), 0)) !== row.score) issues.push(issue("overall_rating_sum_mismatch", `${path}/score`, "warning"));
  }
  if (row.overall_score !== undefined) ratings.push(rating("overall", row.overall_score, `${path}/overall_score`, source, true, metadata));
  const sourceUrl = safeSourceUrl(row.url ?? row.product_url);
  if ((row.url ?? row.product_url) != null && !sourceUrl) issues.push(issue("invalid_source_url", `${path}/url`));
  const preservedMetadata: Record<string, Json> = {};
  for (const key of ["markdown_url", "json_url", "image", "offers", "price", "currency", "updated_at", "metadata", "conflicts", "retailers", "retailers_updated", "price_range", "feel", "play_style", "gender", "junior", "court_side", "demand", "handle_length_cm", "productUrl", "level", "player", "inputsPublished", "inputsMissing", "profile", "inputConflicts"]) {
    if (row[key] !== undefined) preservedMetadata[key] = row[key]!;
  }
  if (publishedPadelTrue) {
    preservedMetadata.modelVersion = metadata.modelVersion!;
    preservedMetadata.methodology = metadata.methodology!;
    if (specs?.price !== undefined) preservedMetadata.price = specs.price;
    if (!sourceUrl || new URL(sourceUrl).origin !== "https://padeltrue.com" || new URL(sourceUrl).pathname !== `/rackets/${text(row.slug)}`) issues.push(issue("invalid_padeltrue_evidence_url", `${path}/url`));
    if (!scores || Object.keys(scores).length !== padelTrueCategories.length || padelTrueCategories.some((key) => !Object.hasOwn(scores, key))) issues.push(issue("rating_category_set_mismatch", `${path}/ratings`));
    if (Array.isArray(row.inputsMissing) && row.inputsMissing.length) {
      issues.push(issue("source_rating_missing_inputs", `${path}/inputsMissing`, "warning"));
      const labels: Record<string, string> = { balance: "balans", core: "twardość rdzenia", face: "materiał powierzchni", shape: "kształt", weight: "masa" };
      const missing = row.inputsMissing.map(value => typeof value === "string" && Object.hasOwn(labels, value) ? labels[value] : "nieopisany parametr").join(", ");
      for (const sourceRating of ratings) sourceRating.methodology += `\nModel PadelTrue 1.0. Brakujące dane wejściowe: ${missing}. Model źródła zastępuje brakujące parametry neutralną wartością 0,5; ocena ma niepełne dane i nie jest wynikiem testu gry.`;
    }
    const currency = text(object(specs?.price)?.currency);
    if (currency && currency !== "EUR") for (const sourceRating of ratings.filter(value => value.key === "value" && value.rawValue === null)) {
      sourceRating.methodology += `\nOcena opłacalności nie została podana dla ceny w ${currency}; nie przeliczamy walut ani nie zastępujemy braku zerem.`;
    }
    if (object(row.inputConflicts) && Object.keys(object(row.inputConflicts)!).length) issues.push(issue("source_input_conflict", `${path}/inputConflicts`, "warning"));
    for (const [key, value] of Object.entries(specs ?? {})) {
      const spec = object(value);
      if (!spec || !text(spec.verbatim) || !safeSourceUrl(spec.source) || !["manufacturer", "retailer"].includes(String(spec.sourceType))) issues.push(issue("invalid_specification_evidence", `${path}/specs/${pointer(key)}`));
    }
  }
  if (flatPadelHow) {
    preservedMetadata.source_schema_version = metadata.schema_version!;
    preservedMetadata.methodology = metadata.methodology ?? null;
    for (const key of ["url", "markdown_url", "json_url"]) {
      const url = safeSourceUrl(row[key]);
      const slug = text(row.slug);
      const expectedPath = key === "json_url" ? `/rackets/${slug}.json` : `/equipment/racket/${slug}/${key === "markdown_url" ? "index.md" : ""}`;
      if (!url || new URL(url).origin !== "https://padel.how" || new URL(url).pathname !== expectedPath) issues.push(issue("invalid_padelhow_evidence_url", `${path}/${key}`));
    }
  }
  return { contractVersion: CONTRACT_VERSION, source, inputIndex, externalId, externalIdScope, sourceUrl,
    identity: { brand, name, year, ...(text(row.variant) ? { variant: text(row.variant)! } : {}) },
    observations, ratings, metadata: preservedMetadata, rawPayload: raw, issues };
}

/** Offline parser. Supported source and fixture schemas are documented in packages/domain/README.md.
 * Unsupported envelopes fail closed; per-row errors preserve originals without echoing them in logs. */
export function parseSnapshot(source: SourceCode, input: string | Uint8Array): ParsedSnapshot {
  if (source !== "padeltrue" && source !== "padelhow") throw new SnapshotError("unsupported_source");
  let parsed: Json;
  try { parsed = JSON.parse(typeof input === "string" ? input.replace(/^\uFEFF/, "") : new TextDecoder("utf-8", { fatal: true }).decode(input).replace(/^\uFEFF/, "")) as Json; }
  catch { throw new SnapshotError("invalid_json"); }
  const envelope = object(parsed);
  const rawRows = Array.isArray(parsed) ? parsed : envelope?.rackets;
  if (!Array.isArray(rawRows)) throw new SnapshotError("unsupported_snapshot_envelope");
  const declaredHub = safeSourceUrl(envelope?.hub);
  const declaredMethodology = safeSourceUrl(envelope?.methodology);
  const declaresPadelHow = [declaredHub, declaredMethodology].some((url) => url !== null && new URL(url).origin === "https://padel.how");
  const declaresPadelTrue = declaredMethodology !== null && new URL(declaredMethodology).origin === "https://padeltrue.com";
  if ((source === "padeltrue" && declaresPadelHow) || (source === "padelhow" && declaresPadelTrue)) throw new SnapshotError("source_identity_mismatch");
  const flatPadelHow = source === "padelhow" && (envelope?.schema_version !== undefined || declaresPadelHow);
  if (flatPadelHow && (envelope?.schema_version !== "2026-08-23" || envelope.category !== "rackets" || !declaresPadelHow)) throw new SnapshotError("unsupported_source_schema");
  const publishedPadelTrue = source === "padeltrue" && (envelope?.modelVersion !== undefined || declaresPadelTrue);
  if (publishedPadelTrue && (envelope?.modelVersion !== "1.0" || declaredMethodology !== "https://padeltrue.com/methodology")) throw new SnapshotError("unsupported_source_schema");
  const metadata: ObjectValue = { ...(object(envelope?.metadata) ?? {}) };
  if (flatPadelHow) for (const key of ["generated", "schema_version", "category", "methodology", "hub", "license", "endpoints", "score_categories", "fields", "retailer_note"]) {
    if (envelope?.[key] !== undefined) metadata[key] = envelope[key]!;
  }
  if (publishedPadelTrue) {
    for (const key of ["name", "license", "attribution", "built", "modelVersion", "methodology"]) if (envelope?.[key] !== undefined) metadata[key] = envelope[key]!;
    metadata.rating_scale = { min: 0, max: 100 };
    metadata.rating_scale_evidence = "https://padeltrue.com/methodology";
  }
  const rawCount = envelope?.count ?? metadata.count ?? envelope?.total ?? null;
  if (rawCount !== null && (typeof rawCount !== "number" || !Number.isSafeInteger(rawCount) || rawCount < 0)) throw new SnapshotError("invalid_declared_count");
  const declaredCount = rawCount as number | null;
  const result: ParsedSnapshot = { source, parserVersion: PARSER_VERSION, declaredCount, actualCount: rawRows.length, records: [], recordErrors: [], issues: [], metadata };
  const ids = new Map<string, number[]>();
  rawRows.forEach((raw, inputIndex) => {
    const record = parseRecord(raw, inputIndex, source, Array.isArray(parsed) ? "" : "/rackets", metadata, flatPadelHow, publishedPadelTrue);
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
