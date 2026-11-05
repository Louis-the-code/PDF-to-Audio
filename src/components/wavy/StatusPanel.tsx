import { useMemo } from "react";
import { seededPeaks } from "../../lib/peaks";
import { Waveform } from "../ui/Waveform";

interface Props {
  title: string;
  message: string;
  /** 0..1 when known (generation); undefined while only "busy" (reading the PDF). */
  progress?: number;
  seed: string;
  onCancel: () => void;
}

/** Progress you can see: the waveform fills as segments are actually generated. */
export function StatusPanel({ title, message, progress, seed, onCancel }: Props) {
  const peaks = useMemo(() => seededPeaks(seed, 120), [seed]);
  const percent = progress === undefined ? null : Math.round(progress * 100);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-ink-900/90 p-6 shadow-lift" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {percent !== null && <span className="font-display text-3xl font-semibold tabular-nums text-signal">{percent}%</span>}
      </div>
      <div className="my-6">
        <Waveform peaks={peaks} progress={progress ?? 0} breathing height={72} label={title} />
      </div>
      <p className="min-h-[1.5rem] text-sm text-mist-muted">{message}</p>
      <button
        type="button"
        onClick={onCancel}
        className="press mt-5 h-10 rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-mist-muted hover:border-white/20 hover:text-mist"
      >
        Cancel
      </button>
    </div>
  );
}
