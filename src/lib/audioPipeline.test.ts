import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";

const synthesize = vi.fn();
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), api: { synthesize: (...a: unknown[]) => synthesize(...a) } }));
vi.mock("./retry", async (orig) => {
  const real = await orig<typeof import("./retry")>();
  // No real waiting in tests.
  return { ...real, withRetry: (fn: () => Promise<unknown>, o: object) => real.withRetry(fn, { ...o, sleepFn: () => Promise.resolve() }) };
});

import { createGenerationCache, generateChapters, isAbortError, planChapters } from "./audioPipeline";

const pcmBase64 = Buffer.from(new Int16Array([1, 2, 3, 4]).buffer).toString("base64");
const base = { voice: "Kore" as const, format: "wav" as const, maxChars: 30, onStatus: () => {} };
// Two chapters, three segments in total at maxChars=30.
const TEXT = "[CHAPTER: One]\nFirst sentence is here. Second sentence is here.\n[CHAPTER: Two]\nOther chapter text.";
const tick = () => new Promise((r) => setTimeout(r, 1));

beforeEach(() => {
  synthesize.mockReset();
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:fake");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

describe("generateChapters", () => {
  it("builds one blob per chapter in order", async () => {
    synthesize.mockResolvedValue(pcmBase64);
    const out = await generateChapters({ ...base, text: TEXT, cache: createGenerationCache(), signal: new AbortController().signal });
    expect(out.map((c) => c.title)).toEqual(["One", "Two"]);
    expect(synthesize).toHaveBeenCalledTimes(3);
  });

  it("runs voice requests in parallel and publishes chapters as soon as they are ready", async () => {
    let active = 0;
    let peak = 0;
    synthesize.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
      return pcmBase64;
    });
    const text = Array.from({ length: 6 }, (_, i) => `[CHAPTER: C${i}]\nSentence number ${i} is here.`).join("\n");
    const ready: number[] = [];
    await generateChapters({ ...base, text, cache: createGenerationCache(), signal: new AbortController().signal, concurrency: 3, onChapterReady: (i) => ready.push(i) });
    expect(peak).toBe(3);
    expect(ready.sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("slows down when the provider rate-limits, then finishes", async () => {
    let active = 0;
    let peakAfterLimit = 0;
    let limited = false;
    synthesize.mockImplementation(async () => {
      active++;
      if (limited) peakAfterLimit = Math.max(peakAfterLimit, active);
      await tick();
      active--;
      if (!limited) {
        limited = true;
        throw new ApiError(429, "slow down", "AI_RATE_LIMITED", 1);
      }
      return pcmBase64;
    });
    const text = Array.from({ length: 8 }, (_, i) => `[CHAPTER: C${i}]\nSentence number ${i} is here.`).join("\n");
    const out = await generateChapters({ ...base, text, cache: createGenerationCache(), signal: new AbortController().signal, concurrency: 4 });
    expect(out).toHaveLength(8);
    expect(peakAfterLimit).toBeLessThanOrEqual(4);
  });

  it("reports progress up to the total", async () => {
    synthesize.mockResolvedValue(pcmBase64);
    const progress: number[] = [];
    await generateChapters({ ...base, text: TEXT, cache: createGenerationCache(), signal: new AbortController().signal, onProgress: (d, t) => progress.push(d / t) });
    expect(progress[progress.length - 1]).toBe(1);
  });

  it("resumes after a failure without paying for finished work again", async () => {
    const cache = createGenerationCache();
    synthesize.mockResolvedValueOnce(pcmBase64).mockRejectedValueOnce(new ApiError(422, "rejected", "AI_REJECTED"));
    await expect(generateChapters({ ...base, text: TEXT, cache, signal: new AbortController().signal, concurrency: 1 })).rejects.toThrow("rejected");

    synthesize.mockReset().mockResolvedValue(pcmBase64);
    const out = await generateChapters({ ...base, text: TEXT, cache, signal: new AbortController().signal, concurrency: 1 });
    expect(out).toHaveLength(2);
    expect(synthesize).toHaveBeenCalledTimes(2); // 3 segments, 1 already cached
  });

  it("reuses finished chapters when only another chapter's text changed", async () => {
    const cache = createGenerationCache();
    synthesize.mockResolvedValue(pcmBase64);
    await generateChapters({ ...base, text: TEXT, cache, signal: new AbortController().signal });
    synthesize.mockClear();
    await generateChapters({ ...base, text: TEXT.replace("Other chapter text.", "Edited text."), cache, signal: new AbortController().signal });
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("frees raw audio once a chapter is encoded, but keeps segments another chapter still needs", async () => {
    const cache = createGenerationCache();
    synthesize.mockResolvedValue(pcmBase64);
    const text = "[CHAPTER: A]\nSame line here.\n[CHAPTER: B]\nSame line here.";
    const out = await generateChapters({ ...base, text, cache, signal: new AbortController().signal, concurrency: 1 });
    expect(out).toHaveLength(2);
    expect(cache.segments.size).toBe(0);
    expect(cache.chapters.size).toBe(2);
  });

  it("does not reuse audio for a different voice", async () => {
    const cache = createGenerationCache();
    synthesize.mockResolvedValue(pcmBase64);
    await generateChapters({ ...base, text: "Hello there.", cache, signal: new AbortController().signal });
    await generateChapters({ ...base, voice: "Puck", text: "Hello there.", cache, signal: new AbortController().signal });
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it("stops spending quota once cancelled", async () => {
    const controller = new AbortController();
    synthesize.mockImplementation(async () => {
      controller.abort();
      return pcmBase64;
    });
    const err = await generateChapters({ ...base, text: TEXT, cache: createGenerationCache(), signal: controller.signal, concurrency: 1 }).catch((e) => e);
    expect(isAbortError(err)).toBe(true);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
});

describe("planChapters", () => {
  it("turns a long unstructured text into parts", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ` + "word ".repeat(150).trim()).join("\n\n");
    expect(planChapters(text).length).toBeGreaterThan(1);
    expect(planChapters(text)[0].title).toBe("Part 1");
  });
});
