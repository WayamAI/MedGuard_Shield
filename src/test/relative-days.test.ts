import { describe, it, expect } from "vitest";
import { daysAgo, daysAgoLabel } from "@/lib/dates";

/**
 * The Access review printed "1 days ago" for three of its nine seeded grants,
 * because five call sites each interpolated `${days} days ago` by hand.
 * These pin the wording so a raw interpolation cannot creep back in.
 */
describe("daysAgo", () => {
  it("says yesterday rather than '1 days ago'", () => {
    expect(daysAgo(1)).toBe("yesterday");
  });

  it("says today rather than '0 days ago'", () => {
    expect(daysAgo(0)).toBe("today");
  });

  it("never emits a negative count if a clock skews", () => {
    expect(daysAgo(-3)).toBe("today");
  });

  it("keeps the plural for every real day count", () => {
    expect(daysAgo(2)).toBe("2 days ago");
    expect(daysAgo(90)).toBe("90 days ago");
    expect(daysAgo(243)).toBe("243 days ago");
    expect(daysAgo(512)).toBe("512 days ago");
  });
});

describe("daysAgoLabel", () => {
  it("capitalises the words, for a standalone cell", () => {
    expect(daysAgoLabel(0)).toBe("Today");
    expect(daysAgoLabel(1)).toBe("Yesterday");
  });

  it("leaves a numeric phrase untouched", () => {
    expect(daysAgoLabel(243)).toBe("243 days ago");
  });
});
