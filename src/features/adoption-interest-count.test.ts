import { describe, expect, it } from "vitest";
import { getAdoptionInterestCount } from "./adoption-interest-count";

describe("adoption interest totals", () => {
  it("preserves the public total without receiving interested people's records", () => {
    expect(getAdoptionInterestCount({ interest_count: 7 })).toBe(7);
    expect(getAdoptionInterestCount({ interestCount: 4 })).toBe(4);
    expect(getAdoptionInterestCount({ interest_count: 0, interests: [{ id: "older-copy" }] })).toBe(0);
  });

  it("uses real records when an internal response has no aggregate count", () => {
    expect(getAdoptionInterestCount({ interests: [{ id: "a" }, { id: "b" }] })).toBe(2);
    expect(getAdoptionInterestCount({})).toBe(0);
  });
});
