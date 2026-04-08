import React, { useEffect, useRef, useState, ChangeEvent } from "react";
import { motion } from "motion/react";
import { Upload, AlertCircle } from "lucide-react";
import { AnimatedDownloadButton } from "./ui/AnimatedDownloadButton";
import { pcmToWav } from "../lib/utils";

export function WavyPDF() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasFile, setHasFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  
  const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

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

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden"
    >
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
              <div className="flex flex-col items-center gap-6">
                <div className="flex flex-wrap justify-center gap-2 mb-2">
                  {voices.map(voice => (
                    <button
                      key={voice}
                      onClick={() => setSelectedVoice(voice)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                        selectedVoice === voice 
                          ? 'bg-white text-black border-white' 
                          : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {voice}
                    </button>
                  ))}
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
