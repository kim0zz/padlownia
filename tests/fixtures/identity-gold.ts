import type { SourceIdentity } from "../../packages/domain/src/index.js";

const identity = (name: string, year: number | null = 2026, brand = "Radian"): SourceIdentity => ({ brand, name, year });
export const fixtureLicense = "CC0-1.0 — synthetic identities and manually assigned labels, not source catalogue data";
export const identityGold: { id: string; left: SourceIdentity; right: SourceIdentity; same: boolean }[] = [
  { id: "positive-01", left: identity("Control Pro"), right: identity("RADIAN CONTROL PRO"), same: true },
  { id: "positive-02", left: identity("Attack Lite"), right: identity("attack-lite"), same: true },
  { id: "positive-03", left: identity("AT10 Genius 12K"), right: identity("AT10  Genius 12K 2026"), same: true },
  { id: "positive-04", left: identity("AT10 Genius 18K"), right: identity("at10 genius 18k"), same: true },
  { id: "positive-05", left: identity("Strike Pro+"), right: identity("Strike Pro +"), same: true },
  { id: "positive-06", left: identity("Vértice Control"), right: identity("Vertice Control"), same: true },
  { id: "positive-07", left: identity("Extreme Soft"), right: identity("EXTREME SOFT"), same: true },
  { id: "positive-08", left: identity("Air Motion", 2025), right: identity("Radian Air Motion 2025", 2025), same: true },
  { id: "positive-09", left: identity("Defender Junior"), right: identity("Defender-Junior"), same: true },
  { id: "positive-10", left: identity("Limit Special Edition"), right: identity("Limit special edition"), same: true },
  { id: "positive-11", left: identity("Counter 3K"), right: identity("Counter 3k"), same: true },
  { id: "positive-12", left: { ...identity("Delta"), variant: "Lite" }, right: identity("Delta Lite"), same: true },
  { id: "negative-year", left: identity("Control Pro", 2025), right: identity("Control Pro", 2026), same: false },
  { id: "negative-carbon", left: identity("AT10 Genius 12K"), right: identity("AT10 Genius 18K"), same: false },
  { id: "negative-playstyle", left: identity("Vertex CTRL"), right: identity("Vertex Attack"), same: false },
  { id: "negative-plus", left: identity("Strike Pro"), right: identity("Strike Pro+"), same: false },
  { id: "negative-lite", left: identity("Attack"), right: identity("Attack Lite"), same: false },
  { id: "negative-soft", left: identity("Extreme Soft"), right: identity("Extreme Hard"), same: false },
  { id: "negative-brand", left: identity("Control Pro"), right: identity("Control Pro", 2026, "Arcline"), same: false },
  { id: "negative-edition", left: identity("Delta"), right: identity("Delta Special Edition"), same: false },
  { id: "negative-junior", left: identity("Defender"), right: identity("Defender Junior"), same: false },
  { id: "negative-unknown-year", left: identity("Air Motion", null), right: identity("Air Motion", 2026), same: false },
  { id: "negative-model-number", left: identity("Vertex 03"), right: identity("Vertex 04"), same: false },
  { id: "negative-women", left: identity("Control"), right: identity("Control Women"), same: false },
  { id: "negative-signature", left: identity("AT10 Genius 18K"), right: identity("AT10 Genius 18K Limited"), same: false },
  { id: "negative-unknown-both", left: identity("Same Unknown", null), right: identity("Same Unknown", null), same: false },
];
