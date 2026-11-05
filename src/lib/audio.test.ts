import { describe, expect, it } from "vitest";
import { base64ToPcm, mergePcm } from "./audio";

describe("mergePcm", () => {
  it("concatenates segments with half a second of silence after each", () => {
    const merged = mergePcm([Int16Array.of(1, 2, 3), Int16Array.of(4)]);
    expect(merged.length).toBe(3 + 12000 + 1 + 12000);
    expect([...merged.slice(0, 3)]).toEqual([1, 2, 3]);
    expect(merged[3]).toBe(0);
    expect(merged[3 + 12000]).toBe(4);
  });
});

describe("base64ToPcm", () => {
  it("decodes little-endian 16-bit samples", () => {
    const base64 = Buffer.from([0x01, 0x00, 0xff, 0xff]).toString("base64");
    expect([...base64ToPcm(base64)]).toEqual([1, -1]);
  });

  it("drops a trailing odd byte instead of throwing", () => {
    const base64 = Buffer.from([0x01, 0x00, 0x07]).toString("base64");
    expect([...base64ToPcm(base64)]).toEqual([1]);
  });
});
