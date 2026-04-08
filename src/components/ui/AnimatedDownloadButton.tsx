import React from "react";
import { motion, HTMLMotionProps } from "motion/react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface DownloadButtonProps extends HTMLMotionProps<"button"> {
  isProcessing?: boolean;
  audioUrl?: string | null;
  error?: string | null;
  statusMessage?: string;
}

export function AnimatedDownloadButton({ className, isProcessing, audioUrl, error, statusMessage, onClick, ...props }: DownloadButtonProps) {
  const handleDownload = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = "narrated-audio.mp3";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (error) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={cn(
          "relative flex items-center justify-center gap-2 px-8 py-4 bg-black text-red-400 rounded-full border border-red-500/30 transition-glow hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:border-red-500/50 overflow-hidden cursor-pointer",
          className
        )}
        {...props}
      >
        <AlertCircle className="w-5 h-5" />
        <span className="font-medium">Error: {error}</span>
      </motion.button>
    );
  }

  if (isProcessing) {
    return (
      <motion.button
        className={cn(
          "relative flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-full border border-white/20 overflow-hidden cursor-wait opacity-80 min-w-[200px]",
          className
        )}
        disabled
        {...props}
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-medium">{statusMessage || "Processing PDF..."}</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleDownload}
      className={cn(
        "relative flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-full border border-white/20 transition-glow hover:shadow-glow-premium hover:border-white/50 overflow-hidden group cursor-pointer",
        className
      )}
      {...props}
    >
      <Download className="w-5 h-5 group-hover:-translate-y-1 group-hover:opacity-0 transition-all duration-300 absolute" />
      <span className="opacity-0 group-hover:opacity-100 group-hover:-translate-y-0 translate-y-4 transition-all duration-300 absolute font-medium">
        Download Audio
      </span>
      <span className="opacity-100 group-hover:opacity-0 transition-all duration-300 font-medium">
        Ready to Download
      </span>
    </motion.button>
  );
}
