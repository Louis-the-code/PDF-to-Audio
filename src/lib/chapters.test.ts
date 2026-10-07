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
