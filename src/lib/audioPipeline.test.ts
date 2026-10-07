import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";

const synthesize = vi.fn();
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), api: { synthesize: (...a: unknown[]) => synthesize(...a) } }));

import { generateChapters, isAbortError, type SegmentCache } from "./audioPipeline";

const pcmBase64 = Buffer.from(new Int16Array([1, 2, 3, 4]).buffer).toString("base64");
const base = { voice: "Kore" as const, format: "wav" as const, maxChars: 30, onStatus: () => {} };
// Two chapters, three segments in total at maxChars=30.
const TEXT = "[CHAPTER: One]\nFirst sentence is here. Second sentence is here.\n[CHAPTER: Two]\nOther chapter text.";

beforeEach(() => {
  synthesize.mockReset();
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:fake");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

describe("generateChapters", () => {
  it("builds one blob per chapter", async () => {
    synthesize.mockResolvedValue(pcmBase64);
    const out = await generateChapters({ ...base, text: TEXT, cache: new Map(), signal: new AbortController().signal });
    expect(out.map((c) => c.title)).toEqual(["One", "Two"]);
    expect(synthesize).toHaveBeenCalledTimes(3);
  });

  it("resumes from cached segments after a failure instead of paying twice", async () => {
    const cache: SegmentCache = new Map();
    synthesize.mockResolvedValueOnce(pcmBase64).mockRejectedValueOnce(new ApiError(422, "rejected", "AI_REJECTED"));
    await expect(generateChapters({ ...base, text: TEXT, cache, signal: new AbortController().signal })).rejects.toThrow("rejected");
    expect(cache.size).toBe(1);

    synthesize.mockReset().mockResolvedValue(pcmBase64);
    const out = await generateChapters({ ...base, text: TEXT, cache, signal: new AbortController().signal });
    expect(out).toHaveLength(2);
    expect(synthesize).toHaveBeenCalledTimes(2); // 3 segments, 1 already cached
  });

  it("does not reuse cached audio for a different voice", async () => {
    const cache: SegmentCache = new Map();
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
    const err = await generateChapters({ ...base, text: TEXT, cache: new Map(), signal: controller.signal }).catch((e) => e);
    expect(isAbortError(err)).toBe(true);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
});
