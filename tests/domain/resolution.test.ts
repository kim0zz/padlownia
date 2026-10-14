import { describe, expect, it } from "vitest";
import { normalizeIdentity, resolveIdentity } from "../../packages/domain/src/index.js";
import { identityGold } from "../fixtures/identity-gold.js";

describe("ING-007/008/021/028 exact identity gold evaluation", () => {
  for (const pair of identityGold) {
    it(`${pair.id}: ${pair.same ? "same exact product" : "must not merge"}`, () => {
      const decision = resolveIdentity(normalizeIdentity(pair.left), [{ id: "candidate", identity: normalizeIdentity(pair.right) }]);
      expect(decision.decision === "auto_accepted").toBe(pair.same);
      expect(decision.ruleVersion).toBe("exact-identity-v1");
    });
  }
  it("evaluates nonempty positive and hard-negative denominators and zero false merges", () => {
    const positives = identityGold.filter((x) => x.same);
    const negatives = identityGold.filter((x) => !x.same);
    expect(positives.length).toBeGreaterThanOrEqual(10);
    expect(negatives.length).toBeGreaterThanOrEqual(10);
    const predicted = identityGold.filter((pair) => resolveIdentity(normalizeIdentity(pair.left), [{ id: pair.id, identity: normalizeIdentity(pair.right) }]).decision === "auto_accepted");
    expect(predicted.filter((x) => !x.same).map((x) => x.id)).toEqual([]);
    expect(predicted.length / positives.length).toBe(1);
  });
  it("ING-009 queues ambiguous aliases and duplicate exact candidates instead of arbitrary selection", () => {
    const alias = normalizeIdentity({ brand: "Radian", name: "AT10 Genius", year: 2026 });
    const candidates = ["12K", "18K"].map((variant) => ({ id: variant, identity: normalizeIdentity({ brand: "Radian", name: `AT10 Genius ${variant}`, year: 2026 }) }));
    expect(resolveIdentity(alias, candidates)).toMatchObject({ decision: "needs_review", racketId: null, candidateIds: ["12K", "18K"] });
    expect(resolveIdentity(alias, [{ id: "first", identity: alias }, { id: "second", identity: alias }])).toMatchObject({ decision: "needs_review", reasonCodes: ["ambiguous_exact_candidates"] });
  });
  it("never transfers a named year contrary to the structured identity", () => {
    const identity = normalizeIdentity({ brand: "Radian", name: "Attack 2025", year: 2026 });
    expect(resolveIdentity(identity, []).decision).toBe("needs_review");
    expect(identity.issues[0]!.code).toBe("conflicting_identity_year");
  });
});
