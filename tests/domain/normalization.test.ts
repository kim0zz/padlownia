import { describe, expect, it } from "vitest";
import { normalizeObservation, type ObservationInput } from "../../packages/domain/src/index.js";

const observation = (key: string, rawValue: string | number | null, context: ObservationInput["context"] = {}): ObservationInput => ({ key, rawValue, rawSourcePath: `/specs/${key}`, kind: "unknown", context, attribution: null });

describe("deterministic normalization", () => {
  it("ING-010 retains tolerance and original notation", () => {
    expect(normalizeObservation(observation("weight", "365 ± 5 g"))).toMatchObject({ rawValue: "365 ± 5 g", valueMin: 360, valueMax: 370, numericValue: null, unit: "g", status: "valid", context: { tolerance: 5 } });
  });
  it("preserves overgrip configuration and accepts unicode ranges", () => {
    expect(normalizeObservation(observation("weight", "365–375 g (without overgrip)"))).toMatchObject({ valueMin: 365, valueMax: 375, context: { grips: "without_overgrip" }, status: "valid" });
    expect(normalizeObservation(observation("weight", "370 g with one overgrip"))).toMatchObject({ numericValue: 370, context: { grips: "one_overgrip" }, status: "valid" });
  });
  it("ING-011 keeps qualitative balance separate from centimeters", () => {
    expect(normalizeObservation(observation("balance", "High, head-heavy"))).toMatchObject({ normalizedText: "head_heavy", numericValue: null, valueMin: null, unit: null, status: "valid" });
  });
  it("converts balance only with explicit unit and butt reference", () => {
    expect(normalizeObservation(observation("balance", "265 mm from handle base"))).toMatchObject({ numericValue: 26.5, unit: "cm", context: { referencePoint: "butt" }, status: "valid" });
    expect(normalizeObservation(observation("balance", 26.5, { unit: "cm", referencePoint: "butt" })).numericValue).toBe(26.5);
  });
  it("ING-012 never guesses missing units or measurement reference", () => {
    expect(normalizeObservation(observation("balance", "~26.5"))).toMatchObject({ numericValue: null, status: "unknown", rawValue: "~26.5", issues: [{ code: "unknown_unit", path: "/specs/balance", severity: "warning" }] });
    expect(normalizeObservation(observation("balance", "26.5 cm"))).toMatchObject({ numericValue: null, status: "unknown" });
    expect(normalizeObservation(observation("weight", 365))).toMatchObject({ numericValue: null, status: "unknown" });
  });
  it("ING-006 rejects demographic values as skill levels and wrong semantic fields", () => {
    expect(normalizeObservation(observation("player_level", "women"))).toMatchObject({ normalizedText: null, status: "invalid", issues: [{ code: "invalid_level_category", path: "/specs/player_level", severity: "error" }] });
    expect(normalizeObservation(observation("surface", "~530 cm²"))).toMatchObject({ normalizedText: null, status: "invalid" });
  });
  it("retains missing and malformed numbers as unknown/invalid rather than zero", () => {
    expect(normalizeObservation(observation("weight", null)).numericValue).toBeNull();
    expect(normalizeObservation(observation("weight", "not a number g")).status).toBe("invalid");
    expect(normalizeObservation(observation("weight", "375–365 g")).status).toBe("invalid");
    expect(normalizeObservation(observation("weight", "365 mm")).status).toBe("invalid");
    expect(normalizeObservation(observation("weight", "365 g adjustable weights")).status).toBe("unknown");
    expect(normalizeObservation(observation("shape", "constructor")).status).toBe("unknown");
  });
  it("supports decimal commas and explicit convertible units without inventing precision", () => {
    expect(normalizeObservation(observation("weight", "0,365 kg"))).toMatchObject({ numericValue: 365, unit: "g", status: "valid" });
    expect(normalizeObservation(observation("thickness", "3.8 cm"))).toMatchObject({ numericValue: 38, unit: "mm", status: "valid" });
  });
  it("supports explicit unit-before-tolerance notation and rejects mixed units", () => {
    expect(normalizeObservation(observation("weight", "350 g +/- 10 g"))).toMatchObject({ valueMin: 340, valueMax: 360, unit: "g", context: { tolerance: 10 }, status: "valid" });
    expect(normalizeObservation(observation("weight", "350 g +/- 10 kg"))).toMatchObject({ numericValue: null, status: "invalid" });
  });
  it("does not collapse intermediate or ambiguous balance categories into high/low", () => {
    expect(normalizeObservation(observation("balance", "Medium-high"))).toMatchObject({ normalizedText: "medium_high", status: "valid" });
    expect(normalizeObservation(observation("balance", "Mid-low"))).toMatchObject({ normalizedText: "medium_low", status: "valid" });
    expect(normalizeObservation(observation("balance", "Low to medium, slightly head-light"))).toMatchObject({ normalizedText: null, status: "unknown" });
    expect(normalizeObservation(observation("balance", "Adjustable, head-heavy biased"))).toMatchObject({ normalizedText: null, status: "unknown" });
  });
  it("retains unsupported source prose and missing material markers for review", () => {
    expect(normalizeObservation(observation("weight", "Men 350-370 g; Women 330-350"))).toMatchObject({ numericValue: null, status: "invalid" });
    expect(normalizeObservation(observation("core", "Not specified"))).toMatchObject({ normalizedText: null, status: "unknown" });
    expect(normalizeObservation(observation("player_level", "junior"))).toMatchObject({ normalizedText: null, status: "invalid" });
  });
});
