import { Check, Cloud, Loader2, SkipBack, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import type { GeneratedChapter } from "../../lib/audioPipeline";
import { CustomAudioPlayer } from "../ui/CustomAudioPlayer";

interface Props {
  playlist: GeneratedChapter[];
  index: number;
  onIndexChange: (index: number) => void;
  cloud: { save: () => void; saving: boolean; saved: boolean; status: string | null };
}

export function PlaylistPlayer({ playlist, index, onIndexChange, cloud }: Props) {
  const goTo = (i: number) => {
    if (i >= 0 && i < playlist.length) onIndexChange(i);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col gap-5"
    >
      <div className="flex items-center justify-between px-2">
        <h3 className="text-white font-semibold text-xl">Audio Chapters</h3>
        <div className="flex items-center gap-3">
          {cloud.status && (
            <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} role="status" className="text-xs text-blue-400 font-medium">
              {cloud.status}
            </motion.span>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={cloud.save}
            disabled={cloud.saving || cloud.saved}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 rounded-full text-sm font-bold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/10"
          >
            {cloud.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : cloud.saved ? <Check className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
            {cloud.saved ? "Saved" : "Save to Cloud"}
          </motion.button>
          <span className="text-xs font-medium text-white/50 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
            {index + 1} of {playlist.length}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-2xl border border-white/5">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous chapter"
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors text-white"
        >
          <SkipBack className="w-5 h-5" />
        </motion.button>

        <div className="relative flex-1 group">
          <select
            value={index}
            onChange={(e) => goTo(Number(e.target.value))}
            aria-label="Chapter"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pl-4 pr-10 text-sm text-white outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer group-hover:bg-white/10 transition-colors"
          >
            {playlist.map((chapter, i) => (
              <option key={i} value={i} className="bg-zinc-900 text-white">
                {i + 1}. {chapter.title}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/70 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => goTo(index + 1)}
          disabled={index === playlist.length - 1}
          aria-label="Next chapter"
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors text-white"
        >
          <SkipForward className="w-5 h-5" />
        </motion.button>
      </div>

      <div className="pt-2">
        <CustomAudioPlayer src={playlist[index]?.url} autoPlay onEnded={() => goTo(index + 1)} />
      </div>
    </motion.div>
  );
}
