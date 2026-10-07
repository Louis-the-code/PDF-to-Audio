import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { MAX_RETRY_WAIT_MS, retryDelay, withRetry } from "./retry";

describe("retryDelay", () => {
  it("retries transient failures", () => {
    expect(retryDelay(new ApiError(0, "net", "NETWORK"), 1)).toBe(2000);
    expect(retryDelay(new ApiError(502, "x", "AI_UNAVAILABLE"), 2)).toBe(4000);
    expect(retryDelay(new ApiError(429, "x", "AI_RATE_LIMITED"), 2)).toBe(30000);
  });

  it("does not retry auth, validation or unknown errors", () => {
    expect(retryDelay(new ApiError(401, "x", "UNAUTHENTICATED"), 1)).toBeNull();
    expect(retryDelay(new ApiError(400, "x", "BAD_REQUEST"), 1)).toBeNull();
    expect(retryDelay(new ApiError(422, "x", "AI_REJECTED"), 1)).toBeNull();
    expect(retryDelay(new Error("boom"), 1)).toBeNull();
  });

  it("gives up when the server asks for a long wait", () => {
    expect(retryDelay(new ApiError(429, "x", "RATE_LIMITED", MAX_RETRY_WAIT_MS + 1), 1)).toBeNull();
    expect(retryDelay(new ApiError(429, "x", "RATE_LIMITED", 5000), 1)).toBe(5000);
  });
});

describe("withRetry", () => {
  const noSleep = () => Promise.resolve();

  it("retries until success and reports each wait", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(502, "x", "AI_UNAVAILABLE"))
      .mockRejectedValueOnce(new ApiError(0, "x", "NETWORK"))
      .mockResolvedValue("ok");
    const onWait = vi.fn();
    await expect(withRetry(fn, { onWait, sleepFn: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onWait).toHaveBeenCalledTimes(2);
  });

  it("stops after the retry budget", async () => {
    const fn = vi.fn().mockRejectedValue(new ApiError(502, "x", "AI_UNAVAILABLE"));
    await expect(withRetry(fn, { retries: 2, sleepFn: noSleep })).rejects.toThrow("x");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("fails fast on non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new ApiError(401, "no", "UNAUTHENTICATED"));
    await expect(withRetry(fn, { sleepFn: noSleep })).rejects.toThrow("no");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
