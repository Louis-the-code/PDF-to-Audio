import { describe, expect, it, vi } from "vitest";
import { createModelFallback, isModelUnavailable } from "./gemini";

describe("isModelUnavailable", () => {
  it("recognises missing-model errors only", () => {
    expect(isModelUnavailable({ status: 404, message: "x" })).toBe(true);
    expect(isModelUnavailable(new Error("models/foo is not found for API version v1beta"))).toBe(true);
    expect(isModelUnavailable({ status: 429, message: "RESOURCE_EXHAUSTED" })).toBe(false);
    expect(isModelUnavailable(new Error("API key not valid"))).toBe(false);
  });
});

describe("createModelFallback", () => {
  it("falls back to the next model and remembers the one that worked", async () => {
    const run = vi.fn(async (model: string) => {
      if (model === "fast") throw { status: 404, message: "NOT_FOUND" };
      return `ok:${model}`;
    });
    const withModel = createModelFallback(["fast", "steady"]);
    expect(await withModel(run)).toBe("ok:steady");
    expect(await withModel(run)).toBe("ok:steady");
    expect(run.mock.calls.map(([m]) => m)).toEqual(["fast", "steady", "steady"]);
  });

  it("does not switch models on other errors such as rate limits", async () => {
    const run = vi.fn().mockRejectedValue({ status: 429, message: "RESOURCE_EXHAUSTED" });
    await expect(createModelFallback(["fast", "steady"])(run)).rejects.toMatchObject({ status: 429 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("surfaces the error when every model is unavailable", async () => {
    const run = vi.fn().mockRejectedValue({ status: 404, message: "NOT_FOUND" });
    await expect(createModelFallback(["a", "b"])(run)).rejects.toMatchObject({ status: 404 });
    expect(run).toHaveBeenCalledTimes(2);
  });
});
