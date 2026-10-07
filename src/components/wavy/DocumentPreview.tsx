import { Loader2 } from "lucide-react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "../../lib/pdfjs"; // configures the pdf.js worker

export default function DocumentPreview({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-white/80 font-medium text-sm px-2">Document Preview</h3>
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 h-96 relative flex items-center justify-center">
        <div className="w-full h-full overflow-y-auto overflow-x-hidden flex justify-center p-4">
          <Document
            file={url}
            loading={<Loader2 className="w-6 h-6 text-white/30 animate-spin my-auto" />}
            error={<span className="text-white/50 text-sm my-auto">Failed to load preview</span>}
          >
            <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} width={320} className="rounded-lg overflow-hidden shadow-lg" />
          </Document>
        </div>
      </div>
    </div>
  );
}
