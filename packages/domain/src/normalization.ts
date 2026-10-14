import { NORMALIZER_VERSION, type Issue, type NormalizedObservation, type NormalizedRecord, type ObservationInput, type SourceRecord } from "./types.js";
import { normalizeIdentity } from "./resolution.js";

const emptyValues = new Set(["", "unknown", "n/a", "na", "-", "?", "not available", "brak"]);
const normalizedString = (value: string) => value.trim().toLowerCase().replaceAll(",", ".");
const shapes: Record<string, string> = { round: "round", "okrągła": "round", diamond: "diamond", "diament": "diamond", teardrop: "teardrop", "tear drop": "teardrop", "łza": "teardrop", hybrid: "hybrid" };
const levels = new Set(["beginner", "intermediate", "advanced", "professional", "all levels"]);

function blank(input: ObservationInput): NormalizedObservation {
  return { ...input, context: { ...input.context }, status: "unknown", normalizedText: null, numericValue: null, valueMin: null, valueMax: null, unit: null, issues: [] };
}
function problem(result: NormalizedObservation, code: string, invalid = false): NormalizedObservation {
  result.issues.push({ code, path: result.rawSourcePath, severity: invalid ? "error" : "warning" });
  result.status = invalid ? "invalid" : "unknown";
  return result;
}

/** No numeric coercion from field suffixes. Units and balance reference must be explicit. */
export function normalizeObservation(input: ObservationInput): NormalizedObservation {
  const result = blank(input);
  const raw = input.rawValue;
  if (raw === null || (typeof raw === "string" && emptyValues.has(normalizedString(raw)))) return problem(result, "missing_value");
  if (typeof raw !== "string" && typeof raw !== "number") return problem(result, "unsupported_value_type", true);
  const value = normalizedString(String(raw));
  if (input.key === "weight" || input.key === "balance" || input.key === "thickness") {
    if (input.key === "balance" && /\b(head[- ]heavy|high)\b/.test(value) && !/\d/.test(value)) { result.normalizedText = "head_heavy"; result.status = "valid"; return result; }
    if (input.key === "balance" && /\b(head[- ]light|low)\b/.test(value) && !/\d/.test(value)) { result.normalizedText = "head_light"; result.status = "valid"; return result; }
    if (input.key === "balance" && /^(medium|even|balanced)$/.test(value)) { result.normalizedText = "even"; result.status = "valid"; return result; }
    const unitMatch = value.match(/\b(kg|g|mm|cm)\b/);
    const unit = unitMatch?.[1] ?? (typeof input.context.unit === "string" ? input.context.unit.toLowerCase() : null);
    if (!unit) return problem(result, "unknown_unit");
    const allowed = input.key === "weight" ? ["g", "kg"] : ["mm", "cm"];
    if (!allowed.includes(unit)) return problem(result, "incompatible_unit", true);
    if (input.key === "balance" && !/\bfrom (?:the )?(?:butt|handle base|base of (?:the )?handle)\b/.test(value) && input.context.referencePoint !== "butt") return problem(result, "unknown_balance_reference");
    if (/without (?:an? )?overgrip|no overgrip/.test(value)) result.context.grips = "without_overgrip";
    else if (/with (?:one|1|an?) overgrip/.test(value)) result.context.grips = "one_overgrip";
    else if (/overgrip|adjustable|custom weight/.test(value)) result.context.configuration = "nonstandard_unspecified";
    if (/^\s*[~≈]|approximately|approx\./.test(value)) result.context.approximate = true;
    const match = value.match(/^\s*[~≈]?\s*(\d+(?:\.\d+)?)\s*(?:(±|\+\/-|[–—-])\s*(\d+(?:\.\d+)?))?\s*(?:kg|g|mm|cm)?(?=\s|$|\()/);
    if (!match) return problem(result, "unparsed_numeric_value", true);
    // Reject unexplained suffixes: converting a number out of arbitrary prose is unsafe.
    const suffix = value.slice(match[0].length).trim();
    const allowedSuffix = /^(?:\(?\s*(?:(?:with (?:one|1|an?) overgrip)|(?:without (?:an? )?overgrip)|(?:no overgrip)|(?:from (?:the )?(?:butt|handle base|base of (?:the )?handle)))\s*\)?|)$/;
    if (!allowedSuffix.test(suffix)) return problem(result, "unknown_measurement_configuration");
    const first = Number(match[1]);
    const second = match[3] === undefined ? null : Number(match[3]);
    const tolerance = match[2] === "±" || match[2] === "+/-";
    let min = tolerance && second !== null ? first - second : first;
    let max = second === null ? first : tolerance ? first + second : second;
    if (min <= 0 || max < min || !Number.isFinite(min) || !Number.isFinite(max)) return problem(result, "invalid_numeric_range", true);
    const factor = input.key === "weight" ? unit === "kg" ? 1000 : 1 : input.key === "balance" ? unit === "mm" ? 0.1 : 1 : unit === "cm" ? 10 : 1;
    min = Math.round(min * factor * 10000) / 10000; max = Math.round(max * factor * 10000) / 10000;
    if (tolerance && second !== null) result.context.tolerance = second * factor;
    if (input.key === "balance") result.context.referencePoint = "butt";
    result.unit = input.key === "weight" ? "g" : input.key === "balance" ? "cm" : "mm";
    result.valueMin = min; result.valueMax = max; result.numericValue = min === max ? min : null; result.status = "valid";
    return result;
  }
  if (typeof raw !== "string") return problem(result, "text_value_required", true);
  if (input.key === "shape") {
    const shape = Object.hasOwn(shapes, value) ? shapes[value] : undefined;
    if (!shape) return problem(result, "unknown_shape");
    result.normalizedText = shape;
  } else if (input.key === "player_level") {
    if (!levels.has(value)) return problem(result, "invalid_level_category", true);
    result.normalizedText = value.replaceAll(" ", "_");
  } else if (input.key === "surface" || input.key === "texture") {
    if (/\d\s*(?:cm|mm|m)\s*(?:²|2|\^2)/.test(value)) return problem(result, "wrong_semantic_field", true);
    result.normalizedText = value;
  } else {
    result.normalizedText = value;
  }
  result.status = "valid";
  return result;
}

export function normalizeRecord(record: SourceRecord): NormalizedRecord {
  const identity = normalizeIdentity(record.identity);
  const observations = record.observations.map(normalizeObservation);
  const issues: Issue[] = [...record.issues, ...identity.issues];
  const invalid = issues.some((x) => x.severity === "error");
  const needsReview = issues.length > 0 || observations.some((x) => x.status !== "valid") || record.ratings.some((x) => x.status !== "valid");
  return { ...record, identity, observations, issues, status: invalid ? "invalid" : needsReview ? "needs_review" : "valid", normalizerVersion: NORMALIZER_VERSION };
}
