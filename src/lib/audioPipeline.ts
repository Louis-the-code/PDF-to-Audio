import type { Voice } from "../../shared/config";
import { api, ApiError } from "./api";
import { base64ToPcm, encodePcm, mergePcm, type AudioFormat } from "./audio";
import { chunkText } from "./chunkText";
import { parseChapters, splitIntoParts, type ChapterText } from "./chapters";
import { AdaptiveLimit, runPool } from "./pool";
import { withRetry } from "./retry";

export interface GeneratedChapter {
  title: string;
  url: string;
  blob: Blob;
}

/**
 * Work kept across attempts so a retry or a small text edit only regenerates
 * what changed: finished chapters (encoded) and the segments of unfinished ones.
 */
export interface GenerationCache {
  segments: Map<string, Int16Array>;
  chapters: Map<string, Blob>;
}

export const createGenerationCache = (): GenerationCache => ({ segments: new Map(), chapters: new Map() });

/** Voice requests in flight at once, at most. Lowered automatically when the provider rate-limits. */
export const MAX_PARALLEL_VOICE_REQUESTS = 4;

export interface GenerateOptions {
  text: string;
  voice: Voice;
  format: AudioFormat;
  maxChars: number;
  cache: GenerationCache;
  signal: AbortSignal;
  onStatus: (message: string) => void;
  /** Segments finished so far, out of the total. */
  onProgress?: (done: number, total: number) => void;
  /** Called as soon as a chapter is playable, so listening can start before the rest is done. */
  onChapterReady?: (index: number, chapter: GeneratedChapter) => void;
  /** Called when the first segment of a chapter starts. */
  onChapterStarted?: (index: number) => void;
  concurrency?: number;
}

export const isAbortError = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

/** The chapters a text will be voiced as: marked chapters, or automatic parts for unstructured text. */
export function planChapters(text: string): ChapterText[] {
  return splitIntoParts(parseChapters(text));
}

/** Short stable key for long strings (FNV-1a), so cache keys don't hold whole chapters. */
function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + input.length.toString(36);
}

/**
 * Generates one audio file per chapter. All segments of all chapters share one
 * queue in reading order with adaptive parallelism, so the first chapter is
 * ready first and total time is far shorter than one-at-a-time. Each chapter is
 * encoded as soon as its last segment arrives, and its raw audio is released.
 * Object URLs are revoked if generation fails or is cancelled.
 */
export async function generateChapters({
  text,
  voice,
  format,
  maxChars,
  cache,
  signal,
  onStatus,
  onProgress,
  onChapterReady,
  onChapterStarted,
  concurrency = MAX_PARALLEL_VOICE_REQUESTS,
}: GenerateOptions): Promise<GeneratedChapter[]> {
  const chapters = planChapters(text).map((chapter) => ({
    ...chapter,
    key: hash(`${voice}|${format}|${maxChars}|${chapter.title}|${chapter.text}`),
    segments: chunkText(chapter.text, maxChars),
  }));
  const totalSegments = chapters.reduce((sum, c) => sum + c.segments.length, 0);
  const results: (GeneratedChapter | undefined)[] = new Array(chapters.length);
  const remaining = chapters.map((c) => c.segments.length);
  const started = new Set<number>();
  let done = 0;

  const report = () => onProgress?.(done, totalSegments);
  const publish = (index: number, blob: Blob) => {
    const chapter = { title: chapters[index].title, url: URL.createObjectURL(blob), blob };
    results[index] = chapter;
    onChapterReady?.(index, chapter);
  };

  onStatus(`Voicing ${chapters.length} ${chapters.length === 1 ? "section" : "sections"}…`);
  report();

  // Chapters finished in an earlier attempt are ready straight away.
  chapters.forEach((chapter, index) => {
    const blob = cache.chapters.get(chapter.key);
    if (!blob) return;
    done += chapter.segments.length;
    remaining[index] = 0;
    publish(index, blob);
  });
  report();

  const tasks = chapters.flatMap((chapter, chapterIndex) =>
    remaining[chapterIndex] === 0 ? [] : chapter.segments.map((segment, segmentIndex) => ({ chapterIndex, segmentIndex, segment })),
  );
  const segmentKey = (segment: string) => `${voice}\u0000${segment}`;
  // How many unfinished chapters still need each segment: identical text can
  // appear in more than one chapter, so raw audio is only freed at zero.
  const uses = new Map<string, number>();
  for (const { segment } of tasks) uses.set(segmentKey(segment), (uses.get(segmentKey(segment)) ?? 0) + 1);
  const limit = new AdaptiveLimit(Math.max(1, concurrency));

  try {
    await runPool(
      tasks,
      limit,
      async ({ chapterIndex, segment }) => {
        if (!started.has(chapterIndex)) {
          started.add(chapterIndex);
          onChapterStarted?.(chapterIndex);
        }

        const key = segmentKey(segment);
        if (!cache.segments.has(key)) {
          const base64 = await withRetry(() => api.synthesize(segment, voice), {
            retries: 6,
            onWait: (delay, err) => {
              if (err instanceof ApiError && err.status === 429) limit.backoff();
              onStatus(`The voice service asked us to slow down. Continuing in ${Math.round(delay / 1000)}s…`);
            },
          });
          if (signal.aborted) return;
          cache.segments.set(key, base64ToPcm(base64));
          limit.success();
        }

        done++;
        report();
        if (--remaining[chapterIndex] > 0) return;

        // Last segment of this chapter: assemble, encode, publish, free the raw audio.
        const chapter = chapters[chapterIndex];
        onStatus(`Finishing "${chapter.title}"…`);
        const pcm = chapter.segments.map((s) => cache.segments.get(segmentKey(s))!);
        const blob = await encodePcm(mergePcm(pcm), format);
        if (signal.aborted) return;
        cache.chapters.set(chapter.key, blob);
        for (const s of chapter.segments) {
          const k = segmentKey(s);
          const left = (uses.get(k) ?? 1) - 1;
          uses.set(k, left);
          if (left <= 0) cache.segments.delete(k);
        }
        publish(chapterIndex, blob);
      },
      signal,
    );
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    return results as GeneratedChapter[];
  } catch (err) {
    results.forEach((r) => r && URL.revokeObjectURL(r.url));
    throw err;
  }
}
