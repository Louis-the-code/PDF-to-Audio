import { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, X } from "lucide-react";
import type { Step } from "../../hooks/useConversion";
import { spring } from "../../lib/motion";

// react-pdf and pdf.js are large and only needed once a file is chosen.
const DocumentPreview = lazy(() => import("./DocumentPreview"));

interface Props {
  step: Step;
  fileName: string | null;
  pdfUrl: string | null;
  text: string;
  onTextChange: (text: string) => void;
  suggestions: string[];
  onAccept: (heading: string) => void;
  onDismiss: (heading: string) => void;
  onDismissAll: () => void;
  onAutoDetect: () => void;
}

/** The document, on "paper": where reading material is checked before it becomes sound. */
export function ChapterEditor({ step, fileName, pdfUrl, text, onTextChange, suggestions, onAccept, onDismiss, onDismissAll, onAutoDetect }: Props) {
  const editable = step === "review";
  const chapterCount = (text.match(/\[CHAPTER:/g) ?? []).length;

  return (
    <section aria-label="Document" className="flex min-h-[520px] flex-col overflow-hidden rounded-3xl bg-paper text-paper-ink shadow-paper">
      <header className="flex items-center gap-4 border-b border-paper-ink/10 px-5 py-4 sm:px-6">
        {pdfUrl && (
          <Suspense fallback={<div className="h-[72px] w-[54px] shrink-0 rounded-md bg-white shadow-paper" />}>
            <DocumentPreview url={pdfUrl} />
          </Suspense>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold" title={fileName ?? undefined}>
            {fileName ?? "Your document"}
          </h2>
          <p className="mt-0.5 text-sm text-paper-muted">
            {step === "extracting"
              ? "Reading the text…"
              : chapterCount > 0
                ? `${chapterCount} chapter${chapterCount === 1 ? "" : "s"} marked`
                : "One continuous recording"}
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={onAutoDetect}
            className="press hidden h-9 shrink-0 rounded-lg border border-paper-ink/15 px-3 text-sm font-medium hover:bg-paper-ink/5 sm:block"
          >
            Find chapters
          </button>
        )}
      </header>

      <AnimatePresence initial={false}>
        {editable && suggestions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden border-b border-paper-ink/10 bg-paper-ink/[0.03]"
          >
            <div className="px-5 py-3.5 sm:px-6">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Suggested chapter breaks</span>
                <button type="button" onClick={onDismissAll} className="text-sm text-paper-muted hover:text-paper-ink">
                  Dismiss all
                </button>
              </div>
              <ul className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {suggestions.map((heading) => (
                    <motion.li
                      key={heading}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={spring.tactile}
                      className="flex items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-paper-ink/10"
                    >
                      <button
                        type="button"
                        onClick={() => onAccept(heading)}
                        aria-label={`Add chapter break: ${heading}`}
                        className="press flex max-w-[260px] items-center gap-1.5 py-1.5 pl-3 pr-2 text-sm hover:bg-signal/10"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-signal-strong" />
                        <span className="truncate">{heading}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismiss(heading)}
                        aria-label={`Dismiss ${heading}`}
                        className="press grid h-8 w-8 place-items-center text-paper-muted hover:bg-paper-ink/5 hover:text-paper-ink"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step === "extracting" ? (
        <div className="flex-1 space-y-3 px-5 py-6 sm:px-6" aria-hidden>
          {[92, 100, 84, 96, 70, 0, 88, 100, 76].map((w, i) => (
            <div
              key={i}
              className="h-3.5 animate-pulse rounded-full bg-paper-ink/[0.07]"
              style={{ width: `${w}%`, animationDelay: `${i * 90}ms`, visibility: w ? "visible" : "hidden" }}
            />
          ))}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          readOnly={!editable}
          aria-label="Extracted text"
          className="min-h-[360px] w-full flex-1 resize-none bg-transparent px-5 py-5 text-[15px] leading-7 text-paper-ink outline-none placeholder:text-paper-muted focus-visible:outline-none sm:px-6"
          placeholder="Extracted text will appear here…"
        />
      )}

      {editable && (
        <footer className="border-t border-paper-ink/10 px-5 py-3 text-[13px] text-paper-muted sm:px-6">
          Put <code className="rounded bg-paper-ink/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-paper-ink">[CHAPTER: Title]</code> on its own line to start a new chapter.
        </footer>
      )}
    </section>
  );
}
