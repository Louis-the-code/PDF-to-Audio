import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1, RotateCcw, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';

interface CustomAudioPlayerProps {
  src?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
}

export function CustomAudioPlayer({ src, autoPlay, onEnded }: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (autoPlay) {
        audioRef.current.play().catch(console.error);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (amount: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += amount;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cycleSpeed = () => {
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackRate(speeds[nextIndex]);
  };

  return (
    <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 mt-2 shadow-inner">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      {/* Progress Bar */}
      <div className="flex items-center gap-3 text-xs text-white/50 font-medium font-mono">
        <span className="w-10 text-right">{formatTime(currentTime)}</span>
        <div className="relative flex-1 h-1.5 group flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="w-full h-full bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              transition={{ type: "tween", ease: "linear", duration: 0.1 }}
            />
          </div>
          {/* Thumb */}
          <motion.div 
            className="absolute h-3 w-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-none"
            style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
            animate={{ scale: isPlaying ? 1 : 0.8 }}
          />
        </div>
        <span className="w-10">{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Left: Speed */}
        <div className="flex items-center w-24">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={cycleSpeed}
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors border border-white/5"
            title="Playback Speed"
          >
            {playbackRate}x
          </motion.button>
        </div>

        {/* Center: Playback */}
        <div className="flex items-center gap-5">
          <motion.button 
            whileHover={{ scale: 1.1, color: "rgba(255,255,255,1)" }}
            whileTap={{ scale: 0.9 }}
            onClick={() => skip(-15)} 
            className="text-white/50 transition-colors" 
            title="Skip back 15s"
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay}
            className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.1, color: "rgba(255,255,255,1)" }}
            whileTap={{ scale: 0.9 }}
            onClick={() => skip(15)} 
            className="text-white/50 transition-colors" 
            title="Skip forward 15s"
          >
            <RotateCw className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Right: Volume */}
        <div className="flex items-center gap-2 w-24 justify-end group">
          <button onClick={() => setIsMuted(!isMuted)} className="text-white/50 hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white opacity-50 group-hover:opacity-100 transition-opacity [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
