import { describe, expect, it } from "vitest";
import { normalizeObservation, selectProjection, type AttributedObservation, type ClaimType } from "../../packages/domain/src/index.js";

function observed(id: string, key: string, rawValue: string, kind: ClaimType = "unknown", verified = false): AttributedObservation {
  return { ...normalizeObservation({ key, rawValue, kind, rawSourcePath: `/specs/${key}`, context: {}, attribution: { name: "Synthetic manufacturer", url: "https://example.com/specs", verified } }), id, source: "padeltrue", sourceUrl: "https://example.com/product", externalId: "synthetic-product" };
}

describe("source-aware canonical projections", () => {
  it("ING-010/027 prefers verified nominal weight while preserving measured overgrip observation", () => {
    const manufacturer = observed("manufacturer", "weight", "365 ± 5 g", "manufacturer_declared", true);
    const specimen = observed("specimen", "weight", "372 g with one overgrip", "measured_specimen");
    const selection = selectProjection([specimen, manufacturer]);
    expect(selection.selected.weight!.id).toBe("manufacturer");
    expect(selection.selected.weight!.valueMin).toBe(360);
    expect(selection.conflicts).toEqual(["weight"]);
    expect(specimen.context.grips).toBe("one_overgrip");
  });
  it("ING-013 refuses arbitrary same-priority conflict resolution", () => {
    const selection = selectProjection([observed("one", "shape", "round"), observed("two", "shape", "diamond")]);
    expect(selection.selected.shape).toBeUndefined();
    expect(selection.conflicts).toEqual(["shape"]);
    expect(selection.unknown).toEqual(["shape"]);
  });
  it("keeps lower-priority disagreement visible alongside verified manufacturer provenance", () => {
    const manufacturer = observed("maker", "shape", "round", "manufacturer_declared", true);
    const selection = selectProjection([manufacturer, observed("retailer", "shape", "diamond", "retailer_claim")]);
    expect(selection.selected.shape!.id).toBe("maker");
    expect(selection.selected.shape!.rawSourcePath).toBe("/specs/shape");
    expect(selection.conflicts).toEqual(["shape"]);
  });
  it("does not certify an aggregator's unverified manufacturer attribution", () => {
    const selection = selectProjection([observed("claim", "shape", "round", "manufacturer_declared"), observed("other", "shape", "diamond", "retailer_claim")]);
    expect(selection.selected.shape).toBeUndefined();
  });
  it("does not turn measurements, opinions or invalid parsing into canonical facts", () => {
    const selection = selectProjection([observed("sample", "weight", "372 g", "measured_specimen"), observed("opinion", "balance", "head-heavy", "editorial_assessment"), observed("unknown", "thickness", "38")]);
    expect(Object.keys(selection.selected)).toEqual([]);
    expect(selection.unknown).toEqual(["balance", "thickness", "weight"]);
  });
});
