import type { AttributedObservation, ProjectionSelection } from "./types.js";

function signature(value: AttributedObservation): string {
  return JSON.stringify([value.normalizedText, value.numericValue, value.valueMin, value.valueMax, value.unit, value.context.grips ?? null, value.context.configuration ?? null]);
}
function rank(value: AttributedObservation): number {
  if (value.kind === "manufacturer_declared" && value.attribution?.verified && value.attribution.url) return 2;
  if (value.kind === "measured_specimen" || value.kind === "editorial_assessment") return 0;
  return 1;
}

/** Main physical values cannot be replaced by a measured specimen or subjective review.
 * Same-rank disagreements remain unknown; lower-ranked disagreements are disclosed. */
export function selectProjection(observations: AttributedObservation[]): ProjectionSelection {
  const result: ProjectionSelection = { selected: Object.create(null) as ProjectionSelection["selected"], conflicts: [], unknown: [] };
  const keys = [...new Set(observations.map((x) => x.key))].sort();
  for (const key of keys) {
    const valid = observations.filter((x) => x.key === key && x.status === "valid");
    const comparable = valid.filter((x) => rank(x) > 0 && x.context.grips !== "one_overgrip" && x.context.configuration !== "nonstandard_unspecified");
    if (new Set(valid.map(signature)).size > 1) result.conflicts.push(key);
    if (!comparable.length) { result.unknown.push(key); continue; }
    const highestRank = Math.max(...comparable.map(rank));
    const preferred = comparable.filter((x) => rank(x) === highestRank).sort((a, b) => a.id.localeCompare(b.id));
    if (new Set(preferred.map(signature)).size > 1) { result.unknown.push(key); continue; }
    result.selected[key] = preferred[0]!;
  }
  return result;
}
