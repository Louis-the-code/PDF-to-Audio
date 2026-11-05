import { describe, expect, it } from "vitest";
import { bytesToPcm, mergePcm } from "./audio";

describe("mergePcm", () => {
  it("concatenates segments with half a second of silence after each", () => {
    const merged = mergePcm([Int16Array.of(1, 2, 3), Int16Array.of(4)]);
    expect(merged.length).toBe(3 + 12000 + 1 + 12000);
    expect([...merged.slice(0, 3)]).toEqual([1, 2, 3]);
    expect(merged[3]).toBe(0);
    expect(merged[3 + 12000]).toBe(4);
  });
});

describe("bytesToPcm", () => {
  it("reads little-endian 16-bit samples", () => {
    expect([...bytesToPcm(Uint8Array.of(0x01, 0x00, 0xff, 0xff).buffer)]).toEqual([1, -1]);
  });

  it("drops a trailing odd byte instead of throwing", () => {
    expect([...bytesToPcm(Uint8Array.of(0x01, 0x00, 0x07).buffer)]).toEqual([1]);
  });
});
