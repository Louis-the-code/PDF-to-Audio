import { describe, expect, it } from "vitest";
import { AdaptiveLimit, runPool } from "./pool";

const tick = () => new Promise((r) => setTimeout(r, 1));

describe("runPool", () => {
  it("keeps result order and never exceeds the limit", async () => {
    let active = 0;
    let peak = 0;
    const out = await runPool([5, 1, 4, 2, 3, 1], new AdaptiveLimit(3), async (n) => {
      active++;
      peak = Math.max(peak, active);
      for (let i = 0; i < n; i++) await tick();
      active--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30, 10]);
    expect(peak).toBe(3);
  });

  it("starts items in order", async () => {
    const started: number[] = [];
    await runPool([0, 1, 2, 3], new AdaptiveLimit(2), async (n) => {
      started.push(n);
      await tick();
    });
    expect(started).toEqual([0, 1, 2, 3]);
  });

  it("stops starting new work after a failure and rethrows it", async () => {
    const started: number[] = [];
    await expect(
      runPool([0, 1, 2, 3, 4], new AdaptiveLimit(1), async (n) => {
        started.push(n);
        if (n === 1) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(started).toEqual([0, 1]);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const run = runPool([0, 1, 2, 3], new AdaptiveLimit(1), async (n) => {
      started.push(n);
      if (n === 0) controller.abort();
    }, controller.signal);
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toEqual([0]);
  });
});

describe("AdaptiveLimit", () => {
  it("halves on backoff and grows back after a streak of successes", () => {
    const limit = new AdaptiveLimit(4, 4, 2);
    limit.backoff();
    expect(limit.current).toBe(2);
    limit.backoff();
    limit.backoff();
    expect(limit.current).toBe(1);
    limit.success();
    limit.success();
    expect(limit.current).toBe(2);
    for (let i = 0; i < 10; i++) limit.success();
    expect(limit.current).toBe(4);
  });
});
