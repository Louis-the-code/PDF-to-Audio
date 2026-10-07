import { api, ApiError } from "./api";
import { withRetry } from "./retry";

/** The server caps cleanup input at this many characters. */
const CLEANUP_LIMIT = 100_000;

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

interface PdfTextItem {
  str: string;
  transform: number[];
}

/** Orders text items top-to-bottom, then left-to-right, and inserts line breaks. */
export function assemblePageText(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => {
    const yA = a.transform[5];
    const yB = b.transform[5];
    return Math.abs(yA - yB) < 5 ? a.transform[4] - b.transform[4] : yB - yA;
  });

  let text = "";
  let lastY: number | null = null;
  for (const item of sorted) {
    if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) text += "\n";
    text += item.str + " ";
    lastY = item.transform[5];
  }
  return text;
}

/** Extracts text in the browser with pdf.js (no network). */
async function extractLocally(file: File): Promise<string> {
  // Loaded on demand: pdf.js is large and only needed for this fallback and the preview.
  const { pdfjs } = await import("./pdfjs");
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let full = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    full += assemblePageText(content.items as PdfTextItem[]) + "\n\n";
  }
  return full;
}

/**
 * Turns a PDF into narration-ready text. Tries the AI extractor first; if that fails,
 * falls back to local extraction followed by an AI cleanup pass (or the raw text if
 * cleanup also fails).
 */
export async function extractDocumentText(file: File, onStatus: (message: string) => void): Promise<string> {
  const onWait = (delay: number) => onStatus(`The AI service is busy. Waiting ${Math.round(delay / 1000)}s before retrying...`);

  onStatus("Extracting text from PDF...");
  let text = "";
  try {
    text = await withRetry(async () => api.extractPdf(await fileToBase64(file)), { onWait });
  } catch (err) {
    // Signing in again is the fix here; the local fallback would only hide the problem.
    if (err instanceof ApiError && err.status === 401) throw err;
    console.warn("AI extraction failed, falling back to local extraction", err);
  }

  if (!text.trim()) {
    onStatus("Falling back to local text extraction...");
    let raw = "";
    try {
      raw = await extractLocally(file);
    } catch (err) {
      console.error("Local extraction failed:", err);
    }

    if (raw.trim()) {
      onStatus("Cleaning up extracted text...");
      try {
        text = (await withRetry(() => api.cleanupText(raw.slice(0, CLEANUP_LIMIT)), { onWait })) || raw;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) throw err;
        console.warn("AI cleanup failed, using raw extracted text", err);
        text = raw;
      }
    }
  }

  if (!text.trim()) {
    throw new Error("Failed to extract text from PDF. The document might be empty or scanned as images.");
  }
  return text;
}
