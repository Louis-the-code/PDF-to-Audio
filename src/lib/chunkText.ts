const isBoundaryAt = (text: string, i: number) => {
  const ch = text[i];
  if (ch === "\n") return true;
  if (ch === "." || ch === "!" || ch === "?") {
    // Sentence end only if followed by whitespace/end, so "3.5" and "e.g.x" don't split.
    return i + 1 >= text.length || /\s/.test(text[i + 1]);
  }
  return false;
};

/**
 * Splits text into pieces of at most `maxLen` characters, preferring to cut at
 * a sentence end, then at whitespace, and only then mid-word. A boundary in
 * the first half of the window is ignored so we don't emit tiny fragments.
 */
export function chunkText(text: string, maxLen: number): string[] {
  if (!(maxLen >= 1)) throw new RangeError("maxLen must be at least 1");
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length);

    if (end < text.length) {
      const minEnd = start + Math.floor(maxLen / 2);
      let cut = -1;
      for (let i = end - 1; i >= minEnd; i--) {
        if (isBoundaryAt(text, i)) {
          cut = i + 1;
          break;
        }
      }
      if (cut === -1) {
        for (let i = end - 1; i >= minEnd; i--) {
          if (/\s/.test(text[i])) {
            cut = i + 1;
            break;
          }
        }
      }
      if (cut !== -1) end = cut;
    }

    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    start = end;
  }
  return chunks;
}
