import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Loader2, Volume2 } from "lucide-react";
import type { Voice } from "../../../shared/config";
import { MAX_SEGMENT_CHARS, MIN_SEGMENT_CHARS } from "../../hooks/useSettings";
import type { AudioFormat } from "../../lib/audio";
import { spring } from "../../lib/motion";

/** Character notes from Google's Gemini voice list, so people choose by sound rather than by name. */
const VOICES: { name: Voice; note: string }[] = [
  { name: "Kore", note: "Firm" },
  { name: "Puck", note: "Upbeat" },
  { name: "Charon", note: "Informative" },
  { name: "Aoede", note: "Breezy" },
  { name: "Fenrir", note: "Excitable" },
  { name: "Zephyr", note: "Bright" },
];

interface Props {
  voice: Voice;
  onVoiceChange: (voice: Voice) => void;
  onPreview: (voice: Voice) => void;
  loadingPreviewVoice: Voice | null;
  format: AudioFormat;
  onFormatChange: (format: AudioFormat) => void;
  maxChars: number;
  onMaxCharsChange: (value: number) => void;
}

export function VoicePicker({ voice, onVoiceChange, onPreview, loadingPreviewVoice, format, onFormatChange, maxChars, onMaxCharsChange }: Props) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-ink-900/90 p-5 shadow-lift sm:p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Voice</h2>
        <span className="text-sm text-mist-faint">Tap the speaker to hear it</span>
      </div>

      <div role="radiogroup" aria-label="Voice" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VOICES.map(({ name, note }) => {
          const selected = voice === name;
          return (
            <div key={name} className="relative">
              {selected && (
                <motion.span
                  layoutId="voice-ring"
                  transition={spring.tactile}
                  className="absolute inset-0 rounded-2xl border border-signal/70 bg-signal/[0.08]"
                />
              )}
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onVoiceChange(name)}
                className={`press relative flex w-full flex-col items-start rounded-2xl border px-3.5 py-3 pr-11 text-left ${
                  selected ? "border-transparent" : "border-white/[0.06] bg-ink-800/60 hover:border-white/[0.14]"
                }`}
              >
                <span className="flex items-center gap-1.5 font-display text-[15px] font-semibold">
                  {name}
                  {selected && <Check className="h-3.5 w-3.5 text-signal" />}
                </span>
                <span className="text-[13px] text-mist-muted">{note}</span>
              </button>
              <button
                type="button"
                onClick={() => onPreview(name)}
                disabled={loadingPreviewVoice === name}
                aria-label={`Preview ${name}`}
                title={`Preview ${name}`}
                className="press absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-mist-muted hover:bg-white/[0.08] hover:text-mist"
              >
                {loadingPreviewVoice === name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        aria-expanded={showOptions}
        className="press mt-5 flex items-center gap-1.5 rounded-lg text-sm text-mist-muted hover:text-mist"
      >
        More options
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showOptions ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {showOptions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <div className="grid gap-5 pt-4 sm:grid-cols-2">
              <div>
                <span className="mb-2 block text-sm font-medium text-mist-muted">File format</span>
                <div className="flex rounded-xl border border-white/[0.06] bg-ink-800/60 p-1">
                  {(["mp3", "wav"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={format === option}
                      onClick={() => onFormatChange(option)}
                      className={`press relative flex-1 rounded-lg py-2 text-sm font-medium ${format === option ? "text-mist" : "text-mist-muted hover:text-mist"}`}
                    >
                      {format === option && <motion.span layoutId="format-pill" transition={spring.tactile} className="absolute inset-0 rounded-lg bg-ink-700" />}
                      <span className="relative">{option.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[13px] text-mist-faint">MP3 files are about ten times smaller.</p>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <label htmlFor="segment-size" className="text-sm font-medium text-mist-muted">Segment size</label>
                  <span className="font-mono text-xs tabular-nums text-mist-faint">{maxChars.toLocaleString()} characters</span>
                </div>
                <input
                  id="segment-size"
                  type="range"
                  min={MIN_SEGMENT_CHARS}
                  max={MAX_SEGMENT_CHARS}
                  step={500}
                  value={maxChars}
                  onChange={(e) => onMaxCharsChange(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-signal"
                />
                <p className="mt-2 text-[13px] text-mist-faint">How much text the voice reads per request.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
