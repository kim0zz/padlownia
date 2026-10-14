import { describe, expect, it } from "vitest";
import { normalizeRecord, parseSnapshot } from "../../packages/domain/src/index.js";

// Entirely invented products and values; structure mirrors the inspected source contract.
const row = {
  name: "Example Control Pro 2026", slug: "example-control-pro-2026", brand: "Example", year: 2026,
  url: "https://padel.how/equipment/racket/example-control-pro-2026/",
  markdown_url: "https://padel.how/equipment/racket/example-control-pro-2026/index.md",
  json_url: "https://padel.how/rackets/example-control-pro-2026.json",
  shape: "Round", thickness_mm: "38", weight_g: "355–365", balance_cm: "26.1", face_material: "Example Carbon", core: "Example foam", surface: "Sand texture", player_level: "intermediate",
  score: 75, scores: { maneuverability: 7.5, net_performance: 7.5, control: 7.5, defensive_output: 7.5, off_center_stability: 7.5, sweet_spot: 7.5, spin_generation: 7.5, power_ceiling: 7.5, power_accessibility: 7.5, comfort: 7.5 },
  retailers: [{ url: "https://example.com/offer", currency: "EUR", price: "100", observed_at: "2026-01-01", affiliate: true }],
  feel: { stiffness: 50, power_on_demand: 7.5, map: { x: 30, y: 40 } }, play_style: ["control"], gender: "unisex", junior: false, court_side: "both", demand: "moderate", handle_length_cm: "12",
};
const envelope = {
  schema_version: "2026-08-23", generated: "2026-08-18", total: 1, category: "rackets", hub: "https://padel.how/equipment/racket/", methodology: "https://padel.how/equipment/racket/methodology/",
  fields: { weight_g: "Unstrung weight range in grams.", thickness_mm: "Profile thickness in millimetres.", balance_cm: "Balance point in centimetres from the butt.", shape: "Head shape as measured on the frame." },
  license: { terms: "https://example.com/terms", summary: "Synthetic permissions text; review before reuse." },
  rackets: [row],
};
const parse = (record = row, definitions = envelope.fields) => parseSnapshot("padelhow", JSON.stringify({ ...envelope, fields: definitions, rackets: [record] }));

describe("profiled padel.how flat schema — synthetic contract examples", () => {
  it("preserves source schema, dates, license and source-specific metadata without asserting rights", () => {
    const result = parse();
    expect(result).toMatchObject({ parserVersion: "1.1.0", declaredCount: 1, actualCount: 1, recordErrors: [] });
    expect(result.metadata).toMatchObject({ schema_version: "2026-08-23", generated: "2026-08-18", license: envelope.license, fields: envelope.fields });
    expect(result.records[0]!.metadata).toMatchObject({ retailers: row.retailers, feel: row.feel, play_style: ["control"], gender: "unisex", junior: false, handle_length_cm: "12" });
    expect(result.records[0]!.rawPayload).toEqual(row);
  });
  it("distinguishes hitting-face material from surface texture with original JSON pointers", () => {
    const observations = parse().records[0]!.observations;
    expect(observations.find((x) => x.key === "surface")).toMatchObject({ rawValue: "Example Carbon", rawSourcePath: "/rackets/0/face_material", kind: "unknown" });
    expect(observations.find((x) => x.key === "texture")).toMatchObject({ rawValue: "Sand texture", rawSourcePath: "/rackets/0/surface" });
    expect(observations.find((x) => x.key === "shape")).toMatchObject({ kind: "measured_specimen", context: { sourceSchemaPath: "/fields/shape" } });
  });
  it("grounds numeric units and balance reference in explicit schema definitions", () => {
    const normalized = normalizeRecord(parse().records[0]!);
    expect(normalized.status).toBe("valid");
    expect(normalized.observations.find((x) => x.key === "weight")).toMatchObject({ valueMin: 355, valueMax: 365, unit: "g", context: { sourceSchemaPath: "/fields/weight_g", sourceSchemaVersion: "2026-08-23" } });
    expect(normalized.observations.find((x) => x.key === "balance")).toMatchObject({ numericValue: 26.1, unit: "cm", context: { referencePoint: "butt" } });
    expect(normalized.observations.find((x) => x.key === "thickness")).toMatchObject({ numericValue: 38, unit: "mm" });
  });
  it("does not infer units from a version or key suffix when definitions are missing or changed", () => {
    const definitions = { weight_g: "Mass range.", thickness_mm: "Thickness.", balance_cm: "Balance.", shape: "Head shape." };
    const normalized = normalizeRecord(parse(row, definitions).records[0]!);
    for (const key of ["weight", "balance", "thickness"]) expect(normalized.observations.find((x) => x.key === key)).toMatchObject({ status: "unknown", numericValue: null, unit: null });
    expect(normalized.status).toBe("needs_review");
  });
  it("retains measured weights and demographic levels as separate evidence/problems", () => {
    const normalized = normalizeRecord(parse({ ...row, weight_g: "360 g (as tested, factory configuration)", player_level: "women", surface: "530 cm²" }).records[0]!);
    expect(normalized.observations.find((x) => x.key === "weight")).toMatchObject({ kind: "measured_specimen", status: "unknown" });
    expect(normalized.observations.find((x) => x.key === "player_level")!.status).toBe("invalid");
    expect(normalized.observations.find((x) => x.key === "texture")!.issues[0]!.code).toBe("wrong_semantic_field");
    expect(normalized.status).toBe("needs_review");
  });
  it("retains 10 editorial category scores and the rounded source total with methodology", () => {
    const record = parse({ ...row, scores: { ...row.scores, comfort: 7 } }).records[0]!;
    expect(record.ratings).toHaveLength(11);
    expect(record.issues).toEqual([]);
    expect(record.ratings.find((x) => x.key === "overall")).toMatchObject({ numericScore: 75, rawValue: 75, rawSourcePath: "/rackets/0/score", scaleMin: 0, scaleMax: 100, kind: "editorial", methodology: envelope.methodology });
    expect(record.ratings.find((x) => x.key === "comfort")).toMatchObject({ numericScore: 7, scaleMax: 10, rawSourcePath: "/rackets/0/scores/comfort" });
  });
  it("flags an inconsistent total without overwriting it", () => {
    const normalized = normalizeRecord(parse({ ...row, score: 99 }).records[0]!);
    expect(normalized.status).toBe("needs_review");
    expect(normalized.issues).toContainEqual({ code: "overall_rating_sum_mismatch", path: "/rackets/0/score", severity: "warning" });
    expect(normalized.ratings.find((x) => x.key === "overall")!.numericScore).toBe(99);
  });
  it("rejects lightweight/missing category/evidence contracts per row", () => {
    const invalid = { ...row } as Record<string, unknown>; delete invalid.face_material; delete (invalid.scores = { ...row.scores } as Record<string, number>).comfort;
    const result = parseSnapshot("padelhow", JSON.stringify({ ...envelope, rackets: [{ ...invalid, markdown_url: "https://example.com/wrong" }] }));
    expect(normalizeRecord(result.records[0]!).status).toBe("invalid");
    expect(result.records[0]!.issues.map((x) => x.code)).toEqual(expect.arrayContaining(["detailed_characteristics_required", "rating_category_set_mismatch", "invalid_padelhow_evidence_url"]));
  });
  it("prevents relabelling a declared padel.how export as PadelTrue", () => {
    expect(() => parseSnapshot("padeltrue", JSON.stringify(envelope))).toThrow("source_identity_mismatch");
    expect(() => parseSnapshot("padelhow", JSON.stringify({ ...envelope, schema_version: "future" }))).toThrow("unsupported_source_schema");
    expect(() => parseSnapshot("padelhow", JSON.stringify({ ...envelope, category: "shoes" }))).toThrow("unsupported_source_schema");
  });
  it("rejects same-origin review links belonging to a different source identity", () => {
    const record = parse({ ...row, json_url: "https://padel.how/rackets/example-other.json" }).records[0]!;
    expect(record.issues).toContainEqual({ code: "invalid_padelhow_evidence_url", path: "/rackets/0/json_url", severity: "error" });
    expect(normalizeRecord(record).status).toBe("invalid");
  });
});
