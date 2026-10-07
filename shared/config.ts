/** Constants shared by the server and the browser client. */

export const VOICES = ["Puck", "Charon", "Fenrir", "Kore", "Aoede", "Zephyr"] as const;
export type Voice = (typeof VOICES)[number];

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_TTS_CHARS = 12_000;
export const MAX_CLEANUP_CHARS = 100_000;

/** TTS output format returned by Gemini: 16-bit little-endian PCM, mono. */
export const TTS_SAMPLE_RATE = 24_000;
export const TTS_CHANNELS = 1;
