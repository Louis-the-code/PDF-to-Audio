export interface ChapterText {
  title: string;
  text: string;
}

const MARKER = /\[CHAPTER:\s*(.*?)\]/g;

/** Splits text on `[CHAPTER: Title]` markers. Text before the first marker becomes "Introduction". */
export function parseChapters(text: string): ChapterText[] {
  const matches = [...text.matchAll(MARKER)];
  if (matches.length === 0) {
    return text.trim() ? [{ title: "Full Document", text: text.trim() }] : [];
  }

  const chapters: ChapterText[] = [];
  let lastIndex = 0;
  let title = "Introduction";

  for (const match of matches) {
    const body = text.slice(lastIndex, match.index).trim();
    if (body) chapters.push({ title, text: body });
    title = match[1].trim() || "Untitled";
    lastIndex = match.index + match[0].length;
  }

  const rest = text.slice(lastIndex).trim();
  if (rest) chapters.push({ title, text: rest });

  return chapters;
}

const HEADING = /^(?:Chapter|Section|Part)\s+(?:\d+|[IVX]+|[A-Z])(?:[\s.:-]|$).{0,80}$/i;
const NUMBERED_HEADING = /^\d+\.\s+[A-Z].{0,80}$/;

/** Finds lines that look like headings and aren't already marked as chapters. */
export function detectChapterSuggestions(text: string): string[] {
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.includes("[CHAPTER:")) continue;
    if (HEADING.test(trimmed) || NUMBERED_HEADING.test(trimmed)) seen.add(trimmed);
  }
  return [...seen];
}

/**
 * Turns the first line that is exactly `heading` into a chapter marker. Matching whole
 * lines avoids rewriting a mention of the heading inside a sentence.
 */
export function acceptChapterSuggestion(text: string, heading: string): string {
  const safeTitle = heading.replace(/\]/g, ")");
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.trim() === heading);
  if (index === -1) return text;
  lines[index] = `[CHAPTER: ${safeTitle}]`;
  return lines.join("\n");
}
