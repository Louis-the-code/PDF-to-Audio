import { Check, Loader2, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ChapterState, Progress } from "../../hooks/useConversion";
import { bouncy } from "../../lib/motion";

interface Props {
  progress: Progress | null;
  statusMessage: string;
  outline: { title: string; state: ChapterState }[];
  /** How many chapters, from the start, can be played right now. */
  playableCount: number;
  onPlay: (index: number) => void;
  onCancel: () => void;
}

const STEPS = ["Read document", "Find chapters", "Create voice", "Ready"];

/** Reading counts for the first quarter of the bar, voicing for the rest. */
function overall(progress: Progress | null): number {
  if (!progress) return 0;
  const fraction = progress.total > 0 ? progress.done / progress.total : 0;
  return progress.stage === "reading" ? fraction * 0.25 : 0.25 + fraction * 0.75;
}

export function ProcessingPanel({ progress, statusMessage, outline, playableCount, onPlay, onCancel }: Props) {
  const value = overall(progress);
  const percent = Math.round(value * 100);
  const activeStep = progress?.stage === "voicing" ? 2 : 0;
  const readyCount = outline.filter((c) => c.state === "ready").length;

  return (
    <motion.section
      aria-label="Progress"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left shadow-2xl backdrop-blur-md sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/10">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {progress?.stage === "voicing" ? "Creating your audio" : "Reading your document"}
          </h2>
          <p className="mt-1 truncate text-sm text-white/50">{statusMessage || "Getting started…"}</p>
        </div>
        <span className="font-bold tabular-nums text-4xl tracking-tight text-white" aria-label={`${percent} percent`}>
          {percent}%
        </span>
      </div>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full w-full origin-left rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)]"
          style={{ transform: `scaleX(${Math.max(0.02, value)})`, transition: "transform 500ms cubic-bezier(0.23, 1, 0.32, 1)" }}
        />
      </div>

      <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((label, i) => {
          const state = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
          return (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${
                state === "pending" ? "border-white/5 text-white/30" : state === "active" ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-white/60"
              }`}
            >
              {state === "done" ? (
                <Check className="h-3.5 w-3.5 text-white" />
              ) : state === "active" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="mx-[3px] h-1.5 w-1.5 rounded-full bg-white/30" />
              )}
              {label}
            </li>
          );
        })}
      </ol>

      {outline.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-1 text-xs text-white/40">
            <span>
              {outline.length} {outline.length === 1 ? "section" : "sections"}
            </span>
            <span>
              {readyCount} of {outline.length} ready
            </span>
          </div>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {outline.map((chapter, i) => {
              const playable = i < playableCount;
              return (
                <li
                  key={`${i}-${chapter.title}`}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-300 ${
                    chapter.state === "ready" ? "border-white/15 bg-white/10" : "border-white/5 bg-black/30"
                  }`}
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-white/40">{i + 1}</span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${chapter.state === "waiting" ? "text-white/50" : "text-white"}`} title={chapter.title}>
                    {chapter.title}
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    {playable ? (
                      <motion.button
                        key="play"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={bouncy}
                        onClick={() => onPlay(i)}
                        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black"
                        aria-label={`Play ${chapter.title}`}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        Play
                      </motion.button>
                    ) : (
                      <motion.span key={chapter.state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-xs text-white/50">
                        {chapter.state === "working" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Voicing
                          </>
                        ) : chapter.state === "ready" ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Ready
                          </>
                        ) : (
                          "Waiting"
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/40">You can start listening as soon as the first section is ready.</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={bouncy}
          onClick={onCancel}
          className="rounded-full border border-white/10 bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          Cancel
        </motion.button>
      </div>
    </motion.section>
  );
}
