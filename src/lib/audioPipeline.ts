import type { Voice } from "../../shared/config";
import { api } from "./api";
import { base64ToPcm, encodePcm, mergePcm, type AudioFormat } from "./audio";
import { chunkText } from "./chunkText";
import { parseChapters } from "./chapters";
import { withRetry } from "./retry";

export interface GeneratedChapter {
  title: string;
  url: string;
  blob: Blob;
}

/** Decoded audio per (voice, text) segment, kept across attempts so a retry resumes where it failed. */
export type SegmentCache = Map<string, Int16Array>;

export interface GenerateOptions {
  text: string;
  voice: Voice;
  format: AudioFormat;
  maxChars: number;
  cache: SegmentCache;
  signal: AbortSignal;
  onStatus: (message: string) => void;
}

export const isAbortError = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
};

/** Generates one audio file per chapter. Object URLs are revoked if generation fails or is cancelled. */
export async function generateChapters({ text, voice, format, maxChars, cache, signal, onStatus }: GenerateOptions): Promise<GeneratedChapter[]> {
  const chapters = parseChapters(text).map((chapter) => ({ ...chapter, segments: chunkText(chapter.text, maxChars) }));
  const totalSegments = chapters.reduce((sum, c) => sum + c.segments.length, 0);
  const summary = `Generating audio for ${totalSegments} segments across ${chapters.length} chapters...`;
  onStatus(summary);

  const results: GeneratedChapter[] = [];
  let done = 0;

  try {
    for (const chapter of chapters) {
      const pcmSegments: Int16Array[] = [];

      for (const segment of chapter.segments) {
        throwIfAborted(signal);
        const key = `${voice}\u0000${segment}`;
        let pcm = cache.get(key);

        if (!pcm) {
          const base64 = await withRetry(() => api.synthesize(segment, voice), {
            retries: 5,
            onWait: (delay) => onStatus(`The AI service is busy. Waiting ${Math.round(delay / 1000)}s before retrying...`),
          });
          pcm = base64ToPcm(base64);
          cache.set(key, pcm);
        }

        pcmSegments.push(pcm);
        onStatus(`Generated audio segment ${++done} of ${totalSegments}...`);
      }

      throwIfAborted(signal);
      onStatus(`Finalizing chapter: ${chapter.title}...`);
      const blob = await encodePcm(mergePcm(pcmSegments), format);
      results.push({ title: chapter.title, url: URL.createObjectURL(blob), blob });
    }
    throwIfAborted(signal);
    return results;
  } catch (err) {
    results.forEach((r) => URL.revokeObjectURL(r.url));
    throw err;
  }
}
