import { api, ApiError } from "./api";
import { splitPdf, type PdfBatch } from "./pdfBatches";
import { AdaptiveLimit, runPool } from "./pool";
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

/** Extracts text in the browser with pdf.js (no network), optionally for a page range. */
async function extractLocally(file: File, from = 1, to = Number.POSITIVE_INFINITY): Promise<string> {
  // Loaded on demand: pdf.js is large and only needed for fallbacks and the preview.
  const { pdfjs } = await import("./pdfjs");
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let full = "";
  for (let i = Math.max(1, from); i <= Math.min(pdf.numPages, to); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    full += assemblePageText(content.items as PdfTextItem[]) + "\n\n";
  }
  return full;
}

export interface ExtractOptions {
  onStatus: (message: string) => void;
  /** Page batches finished so far, out of the total (only reported for large documents). */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** Parallel requests for page batches; lowered automatically if the provider rate-limits. */
const PARALLEL_BATCHES = 4;

const busyMessage = (delay: number) => `The AI service asked us to slow down. Continuing in ${Math.round(delay / 1000)}s…`;

/**
 * Turns a PDF into narration-ready text with chapter markers. Large documents
 * are split into page batches that are read in parallel, so long books are
 * fast and never cut off by the model's answer length. Each batch falls back to
 * local extraction on its own if the AI can't read it.
 */
export async function extractDocumentText(file: File, { onStatus, onProgress, signal }: ExtractOptions): Promise<string> {
  onStatus("Opening your PDF…");
  let batches: PdfBatch[] = [];
  try {
    batches = (await splitPdf(file)).batches;
  } catch (err) {
    // Encrypted or unusual PDFs: send the file as a whole instead.
    console.warn("Could not split the PDF into page batches", err);
  }

  const text = batches.length > 1 ? await extractInBatches(file, batches, { onStatus, onProgress, signal }) : await extractWhole(file, onStatus);
  if (!text.trim()) {
    throw new Error("Failed to extract text from PDF. The document might be empty or scanned as images.");
  }
  return text;
}

async function extractInBatches(file: File, batches: PdfBatch[], { onStatus, onProgress, signal }: ExtractOptions): Promise<string> {
  const total = batches[0].total;
  const limit = new AdaptiveLimit(PARALLEL_BATCHES);
  let done = 0;
  onStatus(`Reading ${total} pages, ${Math.min(PARALLEL_BATCHES, batches.length)} parts at a time…`);
  onProgress?.(0, batches.length);

  const texts = await runPool(
    batches,
    limit,
    async (batch) => {
      let text = "";
      try {
        text = await withRetry(() => api.extractPdf(batch.base64, { from: batch.from, to: batch.to, total }), {
          onWait: (delay, err) => {
            if (err.status === 429) limit.backoff();
            onStatus(busyMessage(delay));
          },
        });
        limit.success();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) throw err;
        console.warn(`AI extraction failed for pages ${batch.from}-${batch.to}; reading them locally`, err);
      }
      if (!text.trim()) text = await extractLocally(file, batch.from, batch.to).catch(() => "");
      onProgress?.(++done, batches.length);
      onStatus(`Read ${Math.min(total, batch.to)} of ${total} pages…`);
      return text.trim();
    },
    signal,
  );
  return texts.filter(Boolean).join("\n\n");
}

/** Small documents (or ones that can't be split): one request, with a local fallback plus AI cleanup. */
async function extractWhole(file: File, onStatus: (message: string) => void): Promise<string> {
  const onWait = (delay: number) => onStatus(busyMessage(delay));

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
  return text;
}
