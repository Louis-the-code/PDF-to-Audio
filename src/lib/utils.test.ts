import { describe, expect, it } from "vitest";
import { pcmToMp3, pcmToWav } from "./utils";

const sine = (samples: number) => {
  const pcm = new Int16Array(samples);
  for (let i = 0; i < samples; i++) pcm[i] = Math.round(8000 * Math.sin(i / 10));
  return new Uint8Array(pcm.buffer);
};

describe("pcmToMp3", () => {
  // Regression: lamejs 1.2.x threw "BitStream is not defined" once bundled, so MP3 export never worked.
  it("encodes real audio into a valid MP3 stream", async () => {
    const blob = await pcmToMp3(sine(48_000), 24_000, 1);
    expect(blob.type).toBe("audio/mpeg");
    expect(blob.size).toBeGreaterThan(10_000);
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    // MPEG audio frame sync: 11 set bits.
    expect(head[0]).toBe(0xff);
    expect(head[1] & 0xe0).toBe(0xe0);
  });

  it("handles input shorter than one frame", async () => {
    const blob = await pcmToMp3(sine(100), 24_000, 1);
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("pcmToWav", () => {
  it("writes a correct 44-byte RIFF header", async () => {
    const pcm = sine(1000);
    const bytes = new Uint8Array(await (await pcmToWav(pcm, 24_000, 1)).arrayBuffer());
    const view = new DataView(bytes.buffer);
    const text = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(24_000); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // channels
    expect(view.getUint32(40, true)).toBe(pcm.length); // data size
    expect(bytes.length).toBe(44 + pcm.length);
  });
});
