import { describe, expect, it } from "vitest";
import { computePeaks, seededPeaks } from "./peaks";

describe("computePeaks", () => {
  it("returns the requested number of values between 0 and 1, loudest at 1", () => {
    const pcm = new Int16Array(10_000);
    for (let i = 5_000; i < 10_000; i++) pcm[i] = i % 2 ? 12_000 : -12_000;
    const peaks = computePeaks(pcm, 10);
    expect(peaks).toHaveLength(10);
    expect(peaks[0]).toBe(0);
    expect(peaks[9]).toBeCloseTo(1);
  });

  it("handles empty audio", () => {
    expect(computePeaks(new Int16Array(0), 4)).toEqual([0, 0, 0, 0]);
  });
});

describe("seededPeaks", () => {
  it("is deterministic per seed and stays in range", () => {
    const a = seededPeaks("chapter-1", 50);
    expect(seededPeaks("chapter-1", 50)).toEqual(a);
    expect(seededPeaks("chapter-2", 50)).not.toEqual(a);
    expect(a.every((v) => v >= 0.12 && v <= 1)).toBe(true);
  });
});
