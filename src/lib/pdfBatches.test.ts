import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { bytesToBase64, planBatches, splitPdf } from "./pdfBatches";

describe("planBatches", () => {
  it("covers every page exactly once", () => {
    expect(planBatches(20, 8)).toEqual([{ from: 1, to: 8 }, { from: 9, to: 16 }, { from: 17, to: 20 }]);
    expect(planBatches(3, 8)).toEqual([{ from: 1, to: 3 }]);
    expect(planBatches(0, 8)).toEqual([]);
  });
});

describe("bytesToBase64", () => {
  it("matches Node's encoder, including large inputs", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});

describe("splitPdf", () => {
  it("splits a real PDF into valid page batches", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 19; i++) doc.addPage([200, 200]);
    const file = new File([await doc.save()], "book.pdf", { type: "application/pdf" });

    const { total, batches } = await splitPdf(file, 8);
    expect(total).toBe(19);
    expect(batches.map((b) => [b.from, b.to])).toEqual([[1, 8], [9, 16], [17, 19]]);
    for (const batch of batches) {
      const part = await PDFDocument.load(Buffer.from(batch.base64, "base64"));
      expect(part.getPageCount()).toBe(batch.to - batch.from + 1);
      expect(Buffer.from(batch.base64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
