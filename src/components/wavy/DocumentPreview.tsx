import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "../../lib/pdfjs"; // configures the pdf.js worker

/** Small first-page thumbnail shown beside the document's name. */
export default function DocumentPreview({ url }: { url: string }) {
  return (
    <div className="h-[72px] w-[54px] shrink-0 overflow-hidden rounded-md bg-white shadow-paper ring-1 ring-black/10">
      <Document file={url} loading={null} error={<span className="sr-only">Preview unavailable</span>}>
        <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} width={54} />
      </Document>
    </div>
  );
}
