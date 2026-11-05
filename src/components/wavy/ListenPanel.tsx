import { Check, ChevronLeft, ChevronRight, CloudUpload, Download, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type { GeneratedChapter } from "../../lib/audioPipeline";
import type { AudioFormat } from "../../lib/audio";
import { spring } from "../../lib/motion";
import { AudioPlayer } from "../ui/AudioPlayer";

interface Props {
  playlist: GeneratedChapter[];
  index: number;
  onIndexChange: (index: number) => void;
  fileName: string | null;
  format: AudioFormat;
  cloud: { save: () => void; saving: boolean; saved: boolean; status: string | null };
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "audio";

export function ListenPanel({ playlist, index, onIndexChange, fileName, format, cloud }: Props) {
  const goTo = (i: number) => {
    if (i >= 0 && i < playlist.length) onIndexChange(i);
  };
  const current = playlist[index];
  const multiple = playlist.length > 1;
  const downloadName = `${safeName(fileName ?? "audiobook")}${multiple ? ` - ${index + 1}. ${safeName(current?.title ?? "")}` : ""}.${format}`;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-ink-900/90 p-5 shadow-lift sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Ready to listen</h2>
          <p className="truncate text-sm text-mist-muted" title={current?.title}>
            {current?.title}
          </p>
        </div>
        {multiple && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="mr-1 font-mono text-xs tabular-nums text-mist-faint">
              {index + 1} / {playlist.length}
            </span>
            <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous chapter" className="press grid h-9 w-9 place-items-center rounded-full text-mist-muted hover:bg-white/[0.06] hover:text-mist disabled:opacity-30">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => goTo(index + 1)} disabled={index === playlist.length - 1} aria-label="Next chapter" className="press grid h-9 w-9 place-items-center rounded-full text-mist-muted hover:bg-white/[0.06] hover:text-mist disabled:opacity-30">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <AudioPlayer src={current?.url} peaks={current?.peaks ?? []} autoPlay onEnded={() => goTo(index + 1)} />

      {multiple && (
        <ol aria-label="Chapters" className="mt-5 max-h-56 space-y-0.5 overflow-y-auto border-t border-white/[0.06] pt-3">
          {playlist.map((chapter, i) => {
            const active = i === index;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={active ? "true" : undefined}
                  className={`press relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${active ? "text-mist" : "text-mist-muted hover:text-mist"}`}
                >
                  {active && <motion.span layoutId="chapter-pill" transition={spring.tactile} className="absolute inset-0 rounded-xl bg-white/[0.06]" />}
                  <span className={`relative w-5 shrink-0 text-right font-mono text-xs tabular-nums ${active ? "text-signal" : "text-mist-faint"}`}>{i + 1}</span>
                  <span className="relative truncate">{chapter.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-5 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-5 sm:grid-cols-2">
        <a
          href={current?.url}
          download={downloadName}
          className="press flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] text-sm font-medium hover:border-white/20 hover:bg-white/[0.03]"
        >
          <Download className="h-4 w-4" />
          {multiple ? "Download chapter" : "Download"}
        </a>
        <button
          type="button"
          onClick={cloud.save}
          disabled={cloud.saving || cloud.saved}
          className={`press flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:cursor-default ${
            cloud.saved ? "bg-ok/15 text-ok" : "bg-lilac text-ink-950 hover:bg-[#c8b9ff] disabled:opacity-70"
          }`}
        >
          {cloud.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : cloud.saved ? <Check className="h-4 w-4" /> : <CloudUpload className="h-4 w-4" />}
          {cloud.saved ? "Saved to Library" : "Save to Library"}
        </button>
      </div>
      {cloud.status && !cloud.saved && (
        <p role="status" className="mt-3 text-center text-sm text-mist-muted">
          {cloud.status}
        </p>
      )}
    </div>
  );
}
