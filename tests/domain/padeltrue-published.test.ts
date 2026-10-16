import { describe, expect, it } from "vitest";
import { normalizeRecord, parseSnapshot } from "../../packages/domain/src/index.js";

const evidence = { source: "https://example.com/manufacturer/product", sourceType: "manufacturer" };
const row = {
  slug: "example-control-2026", name: "Example Control 2026", brand: "Example", year: 2026,
  url: "https://padeltrue.com/rackets/example-control-2026", productUrl: "https://example.com/product", level: "Intermediate", player: null,
  ratings: { power: 60, control: 70, handling: 80, forgiveness: 70, comfort: 70, value: 55 }, inputsPublished: 5, inputsMissing: [] as string[], profile: ["control"],
  specs: {
    shape: { ...evidence, display: "Round", value: "round", verbatim: "Shape: Round" },
    weight: { ...evidence, display: "350 to 370 g (ounces omitted)", min: 350, max: 370, verbatim: "Weight: 350-370 Gr" },
    core: { ...evidence, display: "Medium, Example foam", value: "medium", material: "Example foam", verbatim: "Core: Example foam; feel: medium" },
    surface: { ...evidence, display: "Example carbon", material: "Example carbon", verbatim: "Face: Example carbon" },
    thicknessMm: { ...evidence, display: "38 mm", value: 38, verbatim: "Thickness: 38 mm" },
    balance: { ...evidence, display: "Medium", value: "medium" as string | null, mm: null as number | null, verbatim: "Medium balance" },
    roughSurface: { ...evidence, display: "Yes", value: true, verbatim: "Rough surface" },
    price: { ...evidence, display: "£99", value: 99, currency: "GBP", checkedOn: "2026-01-01", verbatim: "GBP 99" },
  },
};
const envelope = { name: "Synthetic contract dataset", license: "CC0 synthetic", attribution: "Example", built: "2026-01-01", modelVersion: "1.0", methodology: "https://padeltrue.com/methodology", count: 1, rackets: [row] };
const parse = (record: object = row) => parseSnapshot("padeltrue", JSON.stringify({ ...envelope, rackets: [record] }));

describe("profiled PadelTrue model 1.0 — synthetic contract examples", () => {
  it("keeps cited verbatim evidence distinct from normalized supplier values", () => {
    const record = normalizeRecord(parse().records[0]!);
    expect(record.status).toBe("valid");
    expect(record.observations.find((x) => x.key === "weight")).toMatchObject({ rawValue: "Weight: 350-370 Gr", rawSourcePath: "/rackets/0/specs/weight/verbatim", valueMin: 350, valueMax: 370, unit: "g", kind: "manufacturer_declared", attribution: { url: evidence.source, verified: false }, context: { normalizationCandidatePaths: ["/rackets/0/specs/weight/min", "/rackets/0/specs/weight/max"], unitEvidenceUrl: envelope.methodology } });
    expect(record.rawPayload).toEqual(row);
  });
  it("separates core material and firmness, with pointers to each source interpretation", () => {
    const observations = normalizeRecord(parse().records[0]!).observations;
    expect(observations.find((x) => x.key === "core")).toMatchObject({ normalizedText: "example foam", context: { normalizationCandidatePaths: ["/rackets/0/specs/core/material"] } });
    expect(observations.find((x) => x.key === "firmness")).toMatchObject({ normalizedText: "medium", context: { normalizationCandidatePaths: ["/rackets/0/specs/core/value"] } });
    expect(observations.find((x) => x.key === "thickness")).toMatchObject({ numericValue: 38, unit: "mm" });
    expect(observations.find((x) => x.key === "texture")).toMatchObject({ normalizedText: "rough", rawValue: "Rough surface" });
  });
  it("does not call firmness a core material when material is missing", () => {
    const observations = normalizeRecord(parse({ ...row, specs: { ...row.specs, core: { ...row.specs.core, material: null } } }).records[0]!).observations;
    expect(observations.find((x) => x.key === "core")).toMatchObject({ normalizedText: null, status: "unknown" });
    expect(observations.find((x) => x.key === "firmness")).toMatchObject({ normalizedText: "medium", status: "valid" });
  });
  it("keeps model-derived profile tags as one observation attributed to the PadelTrue model", () => {
    const record = normalizeRecord(parse({ ...row, profile: ["arm-friendly", "Control", "arm-friendly"] }).records[0]!);
    expect(record.status).toBe("valid");
    expect(record.observations.filter((x) => x.key === "profile_tags")).toMatchObject([{ normalizedText: "arm-friendly|control", kind: "unknown",
      rawSourcePath: "/rackets/0/profile", context: { derivedBy: "padeltrue:model-1.0" } }]);
    expect(normalizeRecord(parse({ ...row, profile: [] }).records[0]!).observations.some((x) => x.key === "profile_tags")).toBe(false);
  });
  it("keeps source rating scale/version and dated multi-currency prices without conversion", () => {
    const result = parse();
    expect(result.metadata).toMatchObject({ modelVersion: "1.0", built: "2026-01-01", license: "CC0 synthetic", rating_scale: { min: 0, max: 100 } });
    expect(result.records[0]!.ratings).toHaveLength(6);
    expect(result.records[0]!.ratings[0]).toMatchObject({ key: "power", scaleMin: 0, scaleMax: 100, kind: "rule_derived", methodology: envelope.methodology });
    expect(result.records[0]!.metadata).toMatchObject({ price: row.specs.price, inputsPublished: 5, inputsMissing: [], productUrl: row.productUrl });
    expect(result.records[0]!.observations.some((x) => x.key === "price")).toBe(false);
  });
  it("flags supplier conflicts and missing model inputs without filling unknown specs", () => {
    const conflict = { balance: { text: "Synthetic conflict", verbatim: "Low / high", source: evidence.source } };
    const result = normalizeRecord(parse({ ...row, inputsMissing: ["balance"], inputConflicts: conflict }).records[0]!);
    expect(result.status).toBe("needs_review");
    expect(result.metadata.inputConflicts).toEqual(conflict);
    expect(result.issues.map((x) => x.code)).toEqual(expect.arrayContaining(["source_rating_missing_inputs", "source_input_conflict"]));
    expect(result.ratings.every(value => value.methodology.includes("Brakujące dane wejściowe: balans") && value.methodology.includes("0,5") && value.methodology.includes(envelope.methodology))).toBe(true);
    expect(result.ratings.find(value => value.key === "control")).toMatchObject({ rawValue: 70,numericScore: 70,status: "valid",kind: "rule_derived" });
  });
  it("explains an absent non-EUR value rating without fabricating a currency conversion", () => {
    const result = normalizeRecord(parse({ ...row,ratings: { ...row.ratings,value: null } }).records[0]!);
    expect(result.ratings.find(value => value.key === "value")).toMatchObject({ rawValue: null,numericScore: null,status: "unknown",methodology: expect.stringContaining("ceny w GBP") });
    expect(result.ratings.find(value => value.key === "power")!.methodology).toBe(envelope.methodology);
  });
  it("keeps numeric balance unknown without a measurement reference even with millimetres", () => {
    const result = normalizeRecord(parse({ ...row, specs: { ...row.specs, balance: { ...row.specs.balance, value: null, mm: 260, display: "260 mm", verbatim: "260 mm" } } }).records[0]!);
    expect(result.observations.find((x) => x.key === "balance")).toMatchObject({ rawValue: "260 mm", numericValue: null, status: "unknown", context: { sourceMillimeters: 260 }, issues: [{ code: "unknown_balance_reference", path: "/rackets/0/specs/balance/verbatim", severity: "warning" }] });
  });
  it("blocks malformed evidence and ignores source self-verification", () => {
    const result = normalizeRecord(parse({ ...row, specs: { ...row.specs, shape: { ...row.specs.shape, source: "javascript:alert(1)", verified: true } } }).records[0]!);
    expect(result.status).toBe("invalid");
    expect(result.observations.find((x) => x.key === "shape")!.attribution).toMatchObject({ url: null, verified: false });
    expect(result.issues.some((x) => x.code === "invalid_specification_evidence")).toBe(true);
  });
  it("rejects unknown model versions and source mislabelling", () => {
    expect(() => parseSnapshot("padeltrue", JSON.stringify({ ...envelope, modelVersion: "2.0" }))).toThrow("unsupported_source_schema");
    expect(() => parseSnapshot("padelhow", JSON.stringify(envelope))).toThrow("source_identity_mismatch");
  });
  it("rejects same-origin review links belonging to a different source identity", () => {
    const record = parse({ ...row, url: "https://padeltrue.com/rackets/example-other" }).records[0]!;
    expect(record.issues).toContainEqual({ code: "invalid_padeltrue_evidence_url", path: "/rackets/0/url", severity: "error" });
    expect(normalizeRecord(record).status).toBe("invalid");
  });
  it("retains conflicting source evidence and excludes an unverified retailer alternative from main specs", () => {
    const conflict = { text: "Manufacturer lists two different face materials",verbatim: "Face: Carbon / Fiberglass",source: evidence.source };
    const normalized = normalizeRecord(parse({ ...row,inputConflicts: { surface: conflict },specs: { ...row.specs,surface: { ...row.specs.surface,sourceType: "retailer" } } }).records[0]!);
    const surfaces = normalized.observations.filter(value => value.key === "surface");
    expect(surfaces).toHaveLength(2);
    expect(surfaces.every(value => value.status === "unknown" && value.normalizedText === null)).toBe(true);
    expect(surfaces[0]).toMatchObject({ rawValue: row.specs.surface.verbatim,context: { sourceConflict: conflict } });
    expect(surfaces[1]).toMatchObject({ rawValue: conflict.verbatim,rawSourcePath: "/rackets/0/inputConflicts/surface/verbatim",context: { sourceConflict: conflict },issues: [{ code: "unresolved_source_conflict",path: "/rackets/0/inputConflicts/surface/verbatim",severity: "warning" }] });
  });
  it("does not confuse the source model's conflicting core firmness with known foam material", () => {
    const conflict = { text: "Firmness differs in table and prose",verbatim: "Medium / Hard",source: evidence.source };
    const normalized = normalizeRecord(parse({ ...row,inputConflicts: { core: conflict },specs: { ...row.specs,core: { ...row.specs.core,value: null } } }).records[0]!);
    expect(normalized.observations.find(value => value.key === "core")).toMatchObject({ normalizedText: "example foam",status: "valid" });
    expect(normalized.observations.find(value => value.key === "firmness")).toMatchObject({ normalizedText: null,status: "unknown",rawSourcePath: "/rackets/0/inputConflicts/core/verbatim" });
  });
});
