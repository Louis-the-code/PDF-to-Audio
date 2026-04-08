import React, { useEffect, useRef, useState, ChangeEvent } from "react";
import { motion } from "motion/react";
import { Upload, AlertCircle, Volume2, Loader2 } from "lucide-react";
import { AnimatedDownloadButton } from "./ui/AnimatedDownloadButton";
import { pcmToWav } from "../lib/utils";

export function WavyPDF() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasFile, setHasFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

  useEffect(() => {
    audioPreviewRef.current = new Audio();
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.src = "";
      }
    };
  }, []);

  const playVoicePreview = async (voice: string) => {
    if (previewCache[voice]) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = previewCache[voice];
        audioPreviewRef.current.play().catch(console.error);
      }
      return;
    }

    setIsPreviewLoading(true);
    try {
      const text = `Hello, my name is ${voice}.`;
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate preview");
      }

      const data = await response.json();
      const base64Audio = data.audioBase64;
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const wavBlob = pcmToWav(bytes, 24000, 1);
      const url = URL.createObjectURL(wavBlob);

      setPreviewCache(prev => ({ ...prev, [voice]: url }));

      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = url;
        audioPreviewRef.current.play().catch(console.error);
      }
    } catch (err: any) {
      console.error("Preview error:", err);
      setError(err.message || "An error occurred during preview generation");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Mouse-sensitive background tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Tubes Cursor Effect
  useEffect(() => {
    let removeClick: (() => void) | null = null;
    let destroyed = false;

    (async () => {
      const mod = await import(
        /* webpackIgnore: true */
        // @ts-ignore
        "https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js"
      );
      const TubesCursorCtor = (mod as any).default ?? mod;

      if (!canvasRef.current || destroyed) return;

      const app = TubesCursorCtor(canvasRef.current, {
        tubes: {
          colors: ["#f967fb", "#53bc28", "#6958d5"],
          lights: {
            intensity: 200,
            colors: ["#83f36e", "#fe8a2e", "#ff008a", "#60aed5"],
          },
        },
      });

      appRef.current = app;

      const handler = () => {
        const colors = randomColors(3);
        const lights = randomColors(4);
        app.tubes.setColors(colors);
        app.tubes.setLightsColors(lights);
      };
      document.body.addEventListener("click", handler);
      removeClick = () => document.body.removeEventListener("click", handler);
    })();

    return () => {
      destroyed = true;
      if (removeClick) removeClick();
      try {
        appRef.current?.dispose?.();
        appRef.current = null;
      } catch {
        // ignore
      }
    };
  }, []);

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      setHasFile(true);
      setIsProcessing(false);
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds the 10MB limit. Please upload a smaller PDF.");
      setHasFile(true);
      setIsProcessing(false);
      return;
    }

    setHasFile(true);
    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          setStatusMessage("Extracting text from PDF...");
          const textResponse = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfBase64: base64Data })
          });
          
          if (!textResponse.ok) {
            const errorData = await textResponse.json();
            throw new Error(errorData.error || "Failed to extract text");
          }
          
          const { text } = await textResponse.json();

          setStatusMessage("Generating audio...");
          const audioResponse = await fetch('/api/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice: selectedVoice })
          });
          
          if (!audioResponse.ok) {
            const errorData = await audioResponse.json();
            throw new Error(errorData.error || "Failed to generate audio");
          }
          
          const data = await audioResponse.json();
          const base64Audio = data.audioBase64;

          setStatusMessage("Finalizing...");
          const binary = atob(base64Audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          
          const wavBlob = pcmToWav(bytes, 24000, 1);
          const url = URL.createObjectURL(wavBlob);
          
          setAudioUrl(url);
          setIsProcessing(false);
          setStatusMessage("");
        } catch (err: any) {
          console.error(err);
          setError(err.message || "An error occurred during processing");
          setIsProcessing(false);
          setStatusMessage("");
        }
      };
      reader.onerror = () => {
        setError("Failed to read file");
        setIsProcessing(false);
        setStatusMessage("");
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Tubes Cursor Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block h-full w-full" />

      {/* Mouse-sensitive Matrix Gradient Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-30 transition-opacity duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.08), transparent 40%)`,
        }}
      />

      {/* Grid Pattern */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      {/* Main Content */}
      <div className="z-10 flex flex-col items-center justify-center text-center px-4 max-w-3xl">
        <motion.h1 
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6"
        >
          PDF to Audio.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-white/60 text-lg md:text-xl mb-12 max-w-xl"
        >
          Transform your documents into high-fidelity, narrated audio experiences with intelligent sectioning.
        </motion.p>

        {/* Upload & Download Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-8 w-full"
        >
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <input 
              type="file" 
              accept=".pdf,application/pdf" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleUpload} 
            />
            {error ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="flex items-start gap-3 px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 max-w-md text-left">
                  <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{error}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setHasFile(false);
                    setError(null);
                    setAudioUrl(null);
                  }}
                  className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium transition-colors border border-white/10"
                >
                  Try Again
                </motion.button>
              </motion.div>
            ) : !hasFile ? (
              <div 
                className={`flex flex-col items-center gap-6 p-8 rounded-3xl border-2 border-dashed transition-all duration-300 ${
                  isDragging 
                    ? "border-white/50 bg-white/10 scale-105" 
                    : "border-transparent bg-transparent"
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-2 mb-4 w-full max-w-xs z-10 relative">
                  <label htmlFor="voice-select" className="text-sm font-medium text-white/70">
                    Select Voice
                  </label>
                  <div className="flex items-center gap-2 w-full">
                    <div className="relative w-full">
                      <select
                        id="voice-select"
                        value={selectedVoice}
                        onChange={(e) => {
                          const newVoice = e.target.value;
                          setSelectedVoice(newVoice);
                          playVoicePreview(newVoice);
                        }}
                        className="w-full appearance-none bg-white/5 border border-white/10 text-white py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/20 transition-all cursor-pointer"
                      >
                        {voices.map(voice => (
                          <option key={voice} value={voice} className="bg-gray-900 text-white">
                            {voice}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-white/50">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path>
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        playVoicePreview(selectedVoice);
                      }}
                      disabled={isPreviewLoading}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      title="Play voice preview"
                    >
                      {isPreviewLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={triggerFileInput}
                  className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-semibold hover:bg-white/90 transition-colors shadow-glow-white cursor-pointer"
                >
                  <Upload className="w-5 h-5" />
                  Upload PDF
                </motion.button>
                <p className={`text-sm transition-colors duration-300 ${isDragging ? "text-white" : "text-white/40"}`}>
                  or drag and drop your PDF here
                </p>
              </div>
            ) : (
              <AnimatedDownloadButton 
                isProcessing={isProcessing} 
                audioUrl={audioUrl} 
                error={error} 
                statusMessage={statusMessage}
              />
            )}
          </div>

          {/* Audio Player */}
          {audioUrl && !isProcessing && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm"
              style={{ colorScheme: "dark" }}
            >
              <audio 
                controls 
                src={audioUrl} 
                className="w-full h-12 outline-none" 
              />
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function randomColors(count: number) {
  return new Array(count).fill(0).map(
    () =>
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")
  );
}
