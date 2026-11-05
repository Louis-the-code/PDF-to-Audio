import { describe, expect, it } from "vitest";
import { chunkText } from "./chunkText";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("Hello world.", 100)).toEqual(["Hello world."]);
  });

  it("returns nothing for empty or whitespace text", () => {
    expect(chunkText("", 100)).toEqual([]);
    expect(chunkText("   \n ", 100)).toEqual([]);
  });

  it("never exceeds maxLen and keeps every word", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Sentence number ${i} ends here.`).join(" ");
    const chunks = chunkText(text, 120);
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });

  it("prefers sentence boundaries", () => {
    const chunks = chunkText("First sentence is here. Second sentence is here. Third one.", 40);
    expect(chunks[0]).toBe("First sentence is here.");
  });

  it("does not split on decimals or abbreviations without a following space", () => {
    const chunks = chunkText("The value is 3.14159 and rising steadily over time", 25);
    expect(chunks.join(" ")).toBe("The value is 3.14159 and rising steadily over time");
    expect(chunks.some((c) => c.endsWith("3.") || c.endsWith("3.14"))).toBe(false);
  });

  it("ignores boundaries in the first half of the window (no tiny fragments)", () => {
    const chunks = chunkText("A. " + "word ".repeat(30), 60);
    expect(chunks[0].length).toBeGreaterThan(20);
  });

  it("falls back to whitespace, then a hard cut", () => {
    expect(chunkText("aaaa bbbb cccc dddd", 10)).toEqual(["aaaa bbbb", "cccc dddd"]);
    expect(chunkText("x".repeat(25), 10)).toEqual(["x".repeat(10), "x".repeat(10), "xxxxx"]);
  });

  it("splits on newlines", () => {
    expect(chunkText("line one is long enough\nline two is long enough", 30)[0]).toBe("line one is long enough");
  });

  it("rejects an invalid size instead of looping forever", () => {
    expect(() => chunkText("abc", 0)).toThrow(RangeError);
    expect(() => chunkText("abc", NaN)).toThrow(RangeError);
  });
});
