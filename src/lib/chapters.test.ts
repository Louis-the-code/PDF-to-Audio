import { describe, expect, it } from "vitest";
import { acceptChapterSuggestion, detectChapterSuggestions, parseChapters } from "./chapters";

describe("parseChapters", () => {
  it("treats unmarked text as one document", () => {
    expect(parseChapters("Just some text.")).toEqual([{ title: "Full Document", text: "Just some text." }]);
  });

  it("splits on markers and names leading text Introduction", () => {
    const chapters = parseChapters("Preface text.\n[CHAPTER: One]\nFirst body.\n[CHAPTER: Two]\nSecond body.");
    expect(chapters).toEqual([
      { title: "Introduction", text: "Preface text." },
      { title: "One", text: "First body." },
      { title: "Two", text: "Second body." },
    ]);
  });

  it("skips empty chapters and falls back for blank titles", () => {
    const chapters = parseChapters("[CHAPTER: Empty]\n[CHAPTER:  ]\nBody");
    expect(chapters).toEqual([{ title: "Untitled", text: "Body" }]);
  });

  it("returns nothing for empty text", () => {
    expect(parseChapters("  ")).toEqual([]);
  });
});

describe("detectChapterSuggestions", () => {
  it("finds headings, dedupes and skips existing markers", () => {
    const text = ["Chapter 1: Beginnings", "body", "Part II", "3. The Third Thing", "Chapter 1: Beginnings", "[CHAPTER: Chapter 2]", "lowercase. not a heading"].join("\n");
    expect(detectChapterSuggestions(text)).toEqual(["Chapter 1: Beginnings", "Part II", "3. The Third Thing"]);
  });
});

describe("acceptChapterSuggestion", () => {
  it("rewrites the heading line, not an earlier mention in prose", () => {
    const text = "As seen in Chapter 2: Methods the results hold.\nChapter 2: Methods\nBody";
    expect(acceptChapterSuggestion(text, "Chapter 2: Methods")).toBe("As seen in Chapter 2: Methods the results hold.\n[CHAPTER: Chapter 2: Methods]\nBody");
  });

  it("returns the text unchanged when the heading is gone", () => {
    expect(acceptChapterSuggestion("nothing here", "Chapter 1")).toBe("nothing here");
  });

  it("keeps the marker parseable when a title contains a bracket", () => {
    const out = acceptChapterSuggestion("Part A]\nbody text", "Part A]");
    expect(parseChapters(out)[0].title).toBe("Part A)");
  });
});

import { autoMarkChapters, splitIntoParts } from "./chapters";

describe("autoMarkChapters", () => {
  it("marks every detected heading at once", () => {
    const { text, added } = autoMarkChapters("Chapter 1: Start\nbody\nChapter 2: Next\nmore");
    expect(added).toBe(2);
    expect(parseChapters(text).map((c) => c.title)).toEqual(["Chapter 1: Start", "Chapter 2: Next"]);
  });

  it("leaves text that already has markers, or only one heading, alone", () => {
    expect(autoMarkChapters("[CHAPTER: A]\nx\nChapter 2: B\ny").added).toBe(0);
    expect(autoMarkChapters("Chapter 1: Only one\nbody").added).toBe(0);
  });
});

describe("splitIntoParts", () => {
  const para = (n: number) => `Paragraph ${n}. ` + "word ".repeat(200).trim();

  it("splits an unstructured document into parts at paragraph breaks", () => {
    const text = Array.from({ length: 30 }, (_, i) => para(i)).join("\n\n");
    const parts = splitIntoParts([{ title: "Full Document", text }], 5000);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts[0].title).toBe("Part 1");
    expect(parts.every((p) => p.text.length <= 5000 + 1100)).toBe(true);
    expect(parts.map((p) => p.text).join("\n\n")).toBe(text);
  });

  it("keeps real chapters and short documents as they are", () => {
    const chapters = [{ title: "One", text: "x".repeat(50_000) }];
    expect(splitIntoParts(chapters)).toBe(chapters);
    const short = [{ title: "Full Document", text: "short" }];
    expect(splitIntoParts(short)).toBe(short);
  });

  it("folds a tiny tail into the last part", () => {
    const text = [para(1), para(2), para(3), "Tiny end."].join("\n\n");
    const parts = splitIntoParts([{ title: "Full Document", text }], 1100);
    expect(parts[parts.length - 1].text.endsWith("Tiny end.")).toBe(true);
    expect(parts.some((p) => p.text === "Tiny end.")).toBe(false);
  });
});
