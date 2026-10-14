import { MATCH_RULE_VERSION, type IdentityCandidate, type Issue, type MatchDecision, type NormalizedIdentity, type SourceIdentity } from "./types.js";

export function normalizeIdentityText(value: string): string {
  // Keep + as a meaningful token: Pro and Pro+ MUST stay distinct.
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
const variantTokens = (model: string): string[] => model.split(" ").filter((x) => /^(?:\d+k|ctrl|control|attack|lite|light|soft|hard|pro|plus|limited|special|edition|women|woman|junior)$/.test(x));

export function normalizeIdentity(identity: SourceIdentity): NormalizedIdentity {
  const brandKey = normalizeIdentityText(identity.brand);
  let modelKey = normalizeIdentityText(identity.name);
  const issues: Issue[] = [];
  if (!brandKey) issues.push({ code: "missing_brand", path: "/identity/brand", severity: "error" });
  if (modelKey === brandKey || modelKey.startsWith(`${brandKey} `)) modelKey = modelKey.slice(brandKey.length).trim();
  const nameYears = modelKey.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  if (identity.year !== null && nameYears.some((x) => Number(x) !== identity.year)) issues.push({ code: "conflicting_identity_year", path: "/identity/name", severity: "error" });
  if (identity.year !== null) modelKey = modelKey.replace(new RegExp(`\\b${identity.year}\\b`, "g"), "").trim().replace(/\s+/g, " ");
  if (!modelKey) issues.push({ code: "missing_model", path: "/identity/name", severity: "error" });
  if (identity.year === null) issues.push({ code: "unknown_year", path: "/identity/year", severity: "warning" });
  const explicitVariant = normalizeIdentityText(identity.variant ?? "");
  if (explicitVariant && !(` ${modelKey} `).includes(` ${explicitVariant} `)) modelKey = `${modelKey} ${explicitVariant}`;
  const variantKey = variantTokens(modelKey).join(" ");
  const identityKey = JSON.stringify([brandKey, modelKey, variantKey, identity.year]);
  return { ...identity, brandKey, modelKey, variantKey, identityKey, issues };
}

export function resolveIdentity(identity: NormalizedIdentity, candidates: IdentityCandidate[]): MatchDecision {
  const result = (decision: MatchDecision["decision"], list: IdentityCandidate[], reason: string): MatchDecision => ({ decision, racketId: decision === "auto_accepted" ? list[0]!.id : null, candidateIds: list.map((x) => x.id), reasonCodes: [reason], ruleVersion: MATCH_RULE_VERSION });
  const brandCandidates = candidates.filter((x) => x.identity.brandKey === identity.brandKey);
  if (identity.issues.some((x) => x.severity === "error")) return result("needs_review", [], "invalid_identity");
  const exact = brandCandidates.filter((x) => x.identity.identityKey === identity.identityKey);
  if (identity.year === null) return result("needs_review", brandCandidates.filter((x) => x.identity.modelKey === identity.modelKey), "unknown_year");
  if (exact.length === 1) return result("auto_accepted", exact, "exact_brand_model_variant_year");
  if (exact.length > 1) return result("needs_review", exact, "ambiguous_exact_candidates");
  const tokens = new Set(identity.modelKey.split(" "));
  const plausible = brandCandidates.filter((x) => {
    if (x.identity.year !== null && x.identity.year !== identity.year) return false;
    // Explicit variant disagreement is a hard negative, never a fuzzy merge.
    if (identity.variantKey && x.identity.variantKey && identity.variantKey !== x.identity.variantKey) return false;
    const other = x.identity.modelKey.split(" ");
    return other.some((token) => tokens.has(token)) && (other.every((token) => tokens.has(token)) || [...tokens].every((token) => other.includes(token)));
  });
  if (plausible.length) return result("needs_review", plausible, "ambiguous_or_incomplete_alias");
  return result("new_identity", [], "distinct_exact_identity");
}
