import { TTS_CHANNELS, TTS_SAMPLE_RATE } from "../../shared/config";
import { base64ToBytes, pcmToMp3, pcmToWav } from "./utils";

export type AudioFormat = "mp3" | "wav";

/** Half a second of silence at the TTS sample rate, inserted between segments. */
const SILENCE_SAMPLES = TTS_SAMPLE_RATE / 2;

/** Concatenates PCM segments, adding a short pause after each. */
export function mergePcm(segments: Int16Array[]): Int16Array {
  const total = segments.reduce((sum, s) => sum + s.length + SILENCE_SAMPLES, 0);
  const merged = new Int16Array(total);
  let offset = 0;
  for (const segment of segments) {
    merged.set(segment, offset);
    offset += segment.length + SILENCE_SAMPLES; // the silence is already zeroed
  }
  return merged;
}

export function base64ToPcm(base64: string): Int16Array {
  const bytes = base64ToBytes(base64);
  // Copy so the Int16Array owns an aligned buffer, whatever byteOffset the decoder gave us.
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength - (bytes.byteLength % 2)));
}

export function encodePcm(pcm: Int16Array, format: AudioFormat): Promise<Blob> {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return format === "mp3" ? pcmToMp3(bytes, TTS_SAMPLE_RATE, TTS_CHANNELS) : pcmToWav(bytes, TTS_SAMPLE_RATE, TTS_CHANNELS);
}
