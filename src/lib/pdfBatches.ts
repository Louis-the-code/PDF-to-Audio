import { MAX_BATCH_BYTES } from "../../shared/config";

/** Pages per request: small enough that the answer is never cut off, big enough to keep request counts low. */
export const PAGES_PER_BATCH = 8;

export interface PageSpan {
  from: number; // 1-based, inclusive
  to: number;
}

export interface PdfBatch extends PageSpan {
  total: number;
  base64: string;
}

export function planBatches(total: number, perBatch = PAGES_PER_BATCH): PageSpan[] {
  const spans: PageSpan[] = [];
  for (let from = 1; from <= total; from += perBatch) spans.push({ from, to: Math.min(total, from + perBatch - 1) });
  return spans;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/**
 * Splits a PDF into page batches in the browser. A batch that is still too big
 * for one request (scans, large images) is halved until it fits.
 */
export async function splitPdf(file: File, perBatch = PAGES_PER_BATCH): Promise<{ total: number; batches: PdfBatch[] }> {
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const total = source.getPageCount();
  const batches: PdfBatch[] = [];

  const build = async ({ from, to }: PageSpan) => {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(source, Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
    pages.forEach((page) => doc.addPage(page));
    return doc.save();
  };

  const add = async (span: PageSpan) => {
    const bytes = await build(span);
    if (bytes.length > MAX_BATCH_BYTES * 0.95 && span.to > span.from) {
      const mid = Math.floor((span.from + span.to) / 2);
      await add({ from: span.from, to: mid });
      await add({ from: mid + 1, to: span.to });
      return;
    }
    batches.push({ ...span, total, base64: bytesToBase64(bytes) });
  };

  for (const span of planBatches(total, perBatch)) await add(span);
  return { total, batches };
}
