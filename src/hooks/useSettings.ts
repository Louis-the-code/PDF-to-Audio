import { useEffect, useState } from "react";
import { VOICES, type Voice } from "../../shared/config";
import type { AudioFormat } from "../lib/audio";

export const MIN_SEGMENT_CHARS = 1000;
export const MAX_SEGMENT_CHARS = 10_000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage can be blocked (private mode, disabled cookies)
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Settings simply won't persist.
  }
}

/** Voice, format and segment size, remembered between visits. Stored values are validated. */
export function useSettings() {
  const [voice, setVoice] = useState<Voice>(() => {
    const saved = read("wavy_voice");
    return (VOICES as readonly string[]).includes(saved ?? "") ? (saved as Voice) : "Kore";
  });
  const [format, setFormat] = useState<AudioFormat>(() => (read("wavy_format") === "wav" ? "wav" : "mp3"));
  const [maxChars, setMaxChars] = useState<number>(() => {
    const saved = Number.parseInt(read("wavy_maxChars") ?? "", 10);
    // 3,000 characters is about three minutes of speech: short enough that several
    // run in parallel and the first chapter is ready quickly.
    return Number.isFinite(saved) ? Math.min(MAX_SEGMENT_CHARS, Math.max(MIN_SEGMENT_CHARS, saved)) : 3000;
  });
  const [reviewFirst, setReviewFirst] = useState<boolean>(() => read("wavy_reviewFirst") === "true");

  useEffect(() => {
    write("wavy_voice", voice);
    write("wavy_format", format);
    write("wavy_maxChars", String(maxChars));
    write("wavy_reviewFirst", String(reviewFirst));
  }, [voice, format, maxChars, reviewFirst]);

  return { voice, setVoice, format, setFormat, maxChars, setMaxChars, reviewFirst, setReviewFirst };
}
