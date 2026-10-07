import { Loader2, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import type { Voice } from "../../../shared/config";
import { MAX_SEGMENT_CHARS, MIN_SEGMENT_CHARS } from "../../hooks/useSettings";
import type { AudioFormat } from "../../lib/audio";

const VOICE_GROUPS: { category: string; voices: Voice[] }[] = [
  { category: "Male", voices: ["Puck", "Charon", "Fenrir"] },
  { category: "Female", voices: ["Kore", "Aoede", "Zephyr"] },
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

export function SettingsPanel({ voice, onVoiceChange, onPreview, loadingPreviewVoice, format, onFormatChange, maxChars, onMaxCharsChange }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl mb-8 p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-6"
    >
      <div>
        <span className="text-sm font-medium text-white/80 mb-4 block">Voice Persona</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {VOICE_GROUPS.map((group) => (
            <div key={group.category} className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider pl-1">{group.category} Voices</span>
              <div className="flex flex-col gap-2">
                {group.voices.map((name) => {
                  const selected = voice === name;
                  return (
                    <div
                      key={name}
                      className={`relative flex items-center justify-between rounded-2xl border transition-all duration-300 ${
                        selected ? "bg-white/10 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/15"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onVoiceChange(name)}
                        className={`flex-1 p-3 text-left text-sm font-medium rounded-2xl ${selected ? "text-white" : "text-white/70"}`}
                      >
                        {name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onPreview(name)}
                        disabled={loadingPreviewVoice === name}
                        aria-label={`Preview ${name}`}
                        title={`Preview ${name}`}
                        className={`m-2 p-2 rounded-full transition-colors ${
                          selected ? "bg-white/20 text-white hover:bg-white/30" : "bg-white/5 text-white/50 hover:bg-white/15 hover:text-white"
                        }`}
                      >
                        {loadingPreviewVoice === name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <span className="text-sm font-medium text-white/80 mb-3 block">Audio Format</span>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            {(["mp3", "wav"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={format === option}
                onClick={() => onFormatChange(option)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  format === option ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"
                }`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-3">
            <label htmlFor="segment-size" className="text-sm font-medium text-white/80">
              Segment Size
            </label>
            <span className="text-xs font-mono text-white/50 bg-black/40 px-2 py-1 rounded-md">{maxChars} chars</span>
          </div>
          <div className="relative pt-2">
            <input
              id="segment-size"
              type="range"
              min={MIN_SEGMENT_CHARS}
              max={MAX_SEGMENT_CHARS}
              step={500}
              value={maxChars}
              onChange={(e) => onMaxCharsChange(Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-[10px] text-white/40 mt-2 px-1 font-mono">
              <span>1k</span>
              <span>10k</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
