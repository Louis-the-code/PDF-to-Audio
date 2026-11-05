import React from "react";
import { motion, HTMLMotionProps } from "motion/react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface DownloadButtonProps extends HTMLMotionProps<"button"> {
  isProcessing?: boolean;
  audioUrl?: string | null;
  error?: string | null;
  statusMessage?: string;
  format?: 'mp3' | 'wav';
}

export function AnimatedDownloadButton({ className, isProcessing, audioUrl, error, statusMessage, format = 'mp3', onClick, ...props }: DownloadButtonProps) {
  const handleDownload = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = `narrated-audio.${format}`;
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
        animate={{ 
          boxShadow: ["0px 0px 0px rgba(255,255,255,0)", "0px 0px 20px rgba(255,255,255,0.3)", "0px 0px 0px rgba(255,255,255,0)"]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "relative flex items-center justify-center gap-3 px-8 py-4 bg-black text-white rounded-full border border-white/20 overflow-hidden cursor-wait min-w-[220px]",
          className
        )}
        disabled
        {...props}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-5 h-5" />
        </motion.div>
        <span className="font-medium">{statusMessage || "Processing PDF..."}</span>
        
        {/* Subtle progress bar background */}
        <motion.div 
          className="absolute inset-0 bg-white/5 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 10, ease: "linear" }}
        />
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
