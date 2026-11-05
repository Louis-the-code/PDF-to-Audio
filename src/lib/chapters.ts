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

const MARKER_TEST = /\[CHAPTER:/;

/**
 * Applies every detected heading as a chapter break in one go, but only when the
 * text has no chapter markers yet and there are at least two headings (one
 * heading is more likely a title than a structure).
 */
export function autoMarkChapters(text: string): { text: string; added: number } {
  if (MARKER_TEST.test(text)) return { text, added: 0 };
  const headings = detectChapterSuggestions(text);
  if (headings.length < 2) return { text, added: 0 };
  let out = text;
  for (const heading of headings) out = acceptChapterSuggestion(out, heading);
  return { text: out, added: headings.length };
}

/** About 12 minutes of narration: long enough to be a part, short enough to start listening quickly. */
export const PART_CHARS = 12_000;

/**
 * A document with no chapters becomes "Part 1", "Part 2"… split at paragraph
 * breaks, instead of one very long recording. Real chapters are left as they are.
 */
export function splitIntoParts(chapters: ChapterText[], partChars = PART_CHARS): ChapterText[] {
  if (chapters.length !== 1 || chapters[0].title !== "Full Document" || chapters[0].text.length <= partChars * 1.25) {
    return chapters;
  }
  const paragraphs = chapters[0].text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const parts: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > partChars) {
      parts.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) {
    // Fold a tiny tail into the previous part rather than leaving a 30-second "part".
    if (parts.length > 0 && current.length < partChars * 0.25) parts[parts.length - 1] += `\n\n${current}`;
    else parts.push(current);
  }
  return parts.map((text, i) => ({ title: `Part ${i + 1}`, text }));
}
