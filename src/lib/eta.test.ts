import { describe, expect, it } from "vitest";
import { estimateRemainingMs, formatRemaining } from "./eta";

describe("estimateRemainingMs", () => {
  const start = { stage: "voicing", time: 0, done: 0 };

  it("waits for enough data", () => {
    expect(estimateRemainingMs(null, 5, 10, 1000)).toBeNull();
    expect(estimateRemainingMs(start, 1, 10, 1000)).toBeNull();
  });

  it("extrapolates from the observed pace", () => {
    // 4 done in 20 s -> 5 s each -> 6 left -> 30 s
    expect(estimateRemainingMs(start, 4, 10, 20_000)).toBe(30_000);
  });

  it("only counts work done since the stage started", () => {
    expect(estimateRemainingMs({ stage: "voicing", time: 10_000, done: 6 }, 8, 10, 20_000)).toBe(10_000);
  });

  it("returns null when finished", () => {
    expect(estimateRemainingMs(start, 10, 10, 20_000)).toBeNull();
  });
});

describe("formatRemaining", () => {
  it("speaks in plain minutes", () => {
    expect(formatRemaining(30_000)).toBe("Less than a minute left");
    expect(formatRemaining(70_000)).toBe("About a minute left");
    expect(formatRemaining(5 * 60_000)).toBe("About 5 minutes left");
  });
});
