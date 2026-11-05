import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Waveform } from "./Waveform";
import { fade } from "../../lib/motion";

interface Props {
  src?: string;
  /** Loudness envelope for the scrubber; decorative if we don't have the real one. */
  peaks: number[];
  autoPlay?: boolean;
  onEnded?: () => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

const formatTime = (time: number) => {
  if (!Number.isFinite(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function AudioPlayer({ src, peaks, autoPlay, onEnded }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // A new chapter starts at the beginning.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
    setCurrentTime(audio.currentTime);
  };

  const seekTo = (fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = fraction * audio.duration;
    setCurrentTime(audio.currentTime);
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const iconButton =
    "press grid place-items-center h-10 w-10 rounded-full text-mist-muted hover:text-mist hover:bg-white/[0.06] disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          if (autoPlay) e.currentTarget.play().catch(() => {});
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
      />

      <Waveform
        peaks={peaks}
        progress={progress}
        onSeek={seekTo}
        height={64}
        label="Seek"
        valueText={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      />

      <div className="flex justify-between font-mono text-xs tabular-nums text-mist-faint">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Three fixed zones so controls never collide, whatever the panel width. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <div>
          <button
            type="button"
            onClick={() => setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length])}
            className="press h-8 min-w-12 rounded-full border border-white/10 px-2.5 text-xs font-semibold tabular-nums text-mist-muted hover:text-mist hover:border-white/20"
            aria-label={`Playback speed ${rate}x`}
          >
            {rate}×
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button type="button" onClick={() => seekBy(-15)} className={iconButton} aria-label="Back 15 seconds">
            <RotateCcw className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="press grid h-14 w-14 place-items-center rounded-full bg-signal text-ink-950 shadow-signal hover:bg-signal-strong"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={isPlaying ? "pause" : "play"}
                initial={{ opacity: 0, scale: 0.6, filter: "blur(3px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.6, filter: "blur(3px)" }}
                transition={fade}
                className="grid place-items-center"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <button type="button" onClick={() => seekBy(15)} className={iconButton} aria-label="Forward 15 seconds">
            <RotateCw className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={() => setMuted((m) => !m)} className={iconButton} aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}
