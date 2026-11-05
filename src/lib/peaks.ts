/** Loudness envelope of 16-bit PCM, `count` values between 0 and 1, for drawing a waveform. */
export function computePeaks(pcm: Int16Array, count = 96): number[] {
  if (pcm.length === 0) return new Array(count).fill(0);
  const size = Math.max(1, Math.floor(pcm.length / count));
  const peaks: number[] = [];
  for (let b = 0; b < count; b++) {
    let sum = 0;
    const start = b * size;
    const end = Math.min(pcm.length, start + size);
    for (let i = start; i < end; i += 4) sum += pcm[i] * pcm[i];
    peaks.push(Math.sqrt(sum / Math.max(1, (end - start) / 4)));
  }
  const max = Math.max(...peaks);
  if (max === 0) return peaks; // silence
  // sqrt lifts quiet passages so speech reads as a wave, not a few spikes.
  return peaks.map((p) => Math.sqrt(p / max));
}

/** A smooth, deterministic decorative wave for audio we haven't analysed. */
export function seededPeaks(seed: string, count = 96): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const phase = rand() * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const swell = 0.55 + 0.35 * Math.sin(i / 7 + phase) * Math.sin(i / 17 + phase * 2);
    return Math.min(1, Math.max(0.12, swell + (rand() - 0.5) * 0.35));
  });
}
