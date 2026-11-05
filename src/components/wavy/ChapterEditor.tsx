import { Loader2 } from "lucide-react";
import type { Step } from "../../hooks/useConversion";

interface Props {
  step: Step;
  text: string;
  onTextChange: (text: string) => void;
  suggestions: string[];
  onAccept: (heading: string) => void;
  onDismiss: (heading: string) => void;
  onDismissAll: () => void;
  onAutoDetect: () => void;
  onGenerate: () => void;
}

export function ChapterEditor({ step, text, onTextChange, suggestions, onAccept, onDismiss, onDismissAll, onAutoDetect, onGenerate }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-white/80 font-medium text-sm">Review &amp; Edit Chapters</h3>
        {step === "review" && (
          <div className="flex items-center gap-2">
            <button onClick={onAutoDetect} className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-full hover:bg-white/20 transition-colors">
              Auto-Detect
            </button>
            <button onClick={onGenerate} className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-white/90 transition-colors">
              Generate Audio
            </button>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 h-96 overflow-hidden relative flex flex-col">
        {step === "extracting" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
            <span className="text-sm text-white/50">Extracting text...</span>
          </div>
        ) : (
          <>
            <div className="p-3 bg-black/40 border-b border-white/10 text-xs text-white/50 leading-relaxed">
              Insert <code className="bg-white/10 px-1 py-0.5 rounded text-white/80">[CHAPTER: Title]</code> to split the audio into sections.
            </div>

            {suggestions.length > 0 && step === "review" && (
              <div className="p-3 bg-blue-500/10 border-b border-blue-500/20 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-400 font-medium">Suggested Chapter Breaks:</span>
                  <button onClick={onDismissAll} className="text-xs text-blue-400/70 hover:text-blue-400">
                    Dismiss All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {suggestions.map((heading) => (
                    <div key={heading} className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-blue-500/20 text-xs text-white/80">
                      <span className="truncate max-w-[200px]" title={heading}>
                        {heading}
                      </span>
                      <button onClick={() => onAccept(heading)} className="text-green-400 hover:text-green-300 font-medium px-1">
                        Accept
                      </button>
                      <button onClick={() => onDismiss(heading)} className="text-red-400 hover:text-red-300 font-medium px-1">
                        Reject
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              disabled={step !== "review"}
              aria-label="Extracted text"
              className="w-full flex-1 bg-transparent p-4 text-sm text-white/80 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
              placeholder="Extracted text will appear here..."
            />
          </>
        )}
      </div>
    </div>
  );
}
