import { AlertCircle, PenLine, X } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { useWorkspace } from "../context/Workspace";
import { useTubesCursor } from "../hooks/useTubesCursor";
import { useVoicePreview } from "../hooks/useVoicePreview";
import { errorMessage } from "../lib/errors";
import { ChapterEditor } from "./wavy/ChapterEditor";
import { PlaylistPlayer } from "./wavy/PlaylistPlayer";
import { ProcessingPanel } from "./wavy/ProcessingPanel";
import { SettingsPanel } from "./wavy/SettingsPanel";
import { UploadZone } from "./wavy/UploadZone";
import { AnimatedDownloadButton } from "./ui/AnimatedDownloadButton";
import { bouncy } from "../lib/motion";

// react-pdf and pdf.js are large and only needed once a file is chosen.
const DocumentPreview = lazy(() => import("./wavy/DocumentPreview"));

export function WavyPDF() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Lives above the page, so leaving for the Library and coming back keeps everything.
  const { settings, conversion, cloud } = useWorkspace();
  const { step, error, setError } = conversion;
  const preview = useVoicePreview(useCallback((err: unknown) => setError(errorMessage(err)), [setError]));

  useTubesCursor(canvasRef);

  // Track the pointer through CSS variables so moving the mouse doesn't re-render this component.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: globalThis.MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const playerRef = useRef<HTMLDivElement>(null);
  const playFrom = (index: number) => {
    conversion.setChapterIndex(index);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div ref={containerRef} className="relative min-h-screen w-full bg-transparent flex flex-col items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block h-full w-full pointer-events-none" />

      <div
        className="absolute inset-0 z-0 opacity-30 transition-opacity duration-1000 pointer-events-none"
        style={{ background: "radial-gradient(600px circle at var(--mx, 0px) var(--my, 0px), rgba(255,255,255,0.08), transparent 40%)" }}
      />

      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      <div className="z-10 flex flex-col items-center justify-center text-center px-4 max-w-3xl">
        <motion.h1
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6 flex gap-3 md:gap-4 justify-center cursor-default"
        >
          {["PDF", "to", "Audio."].map((word, i) => (
            <motion.span
              key={word}
              whileHover={{ scale: 1.1, rotate: i % 2 === 0 ? 2 : -2, textShadow: "0px 0px 20px rgba(255,255,255,0.8)" }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="inline-block"
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-white/60 text-lg md:text-xl mb-12 max-w-xl"
        >
          Transform your documents into high-fidelity, narrated audio experiences with intelligent sectioning.
        </motion.p>

        {step === "idle" && (
          <SettingsPanel
            voice={settings.voice}
            onVoiceChange={settings.setVoice}
            onPreview={preview.play}
            loadingPreviewVoice={preview.loadingVoice}
            format={settings.format}
            onFormatChange={settings.setFormat}
            maxChars={settings.maxChars}
            onMaxCharsChange={settings.setMaxChars}
            reviewFirst={settings.reviewFirst}
            onReviewFirstChange={settings.setReviewFirst}
          />
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-8 w-full"
        >
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-start gap-3 px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 max-w-md text-left"
            >
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed flex-1">{error}</p>
              <button onClick={() => setError(null)} aria-label="Dismiss error" className="shrink-0 text-red-400/70 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === "idle" && (
            <div className="w-full max-w-2xl">
              <UploadZone onFile={conversion.processFile} />
            </div>
          )}

          {/* While working: listen to finished sections, and see everything else in one big panel. */}
          {conversion.isProcessing && (
            <div className="flex w-full flex-col items-center gap-6">
              {conversion.playlist.length > 0 && (
                <div ref={playerRef} className="w-full">
                  <PlaylistPlayer playlist={conversion.playlist} index={conversion.chapterIndex} onIndexChange={conversion.setChapterIndex} cloud={cloud} canSave={false} />
                </div>
              )}
              <ProcessingPanel
                progress={conversion.progress}
                remainingMs={conversion.remainingMs}
                statusMessage={conversion.statusMessage}
                outline={conversion.outline}
                playableCount={conversion.playlist.length}
                onPlay={playFrom}
                onCancel={conversion.reset}
              />
            </div>
          )}

          {(step === "review" || step === "done") && (
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              {step === "done" && conversion.audioUrl && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <AnimatedDownloadButton isProcessing={false} audioUrl={conversion.audioUrl} statusMessage="" format={settings.format} />
                </motion.div>
              )}
              {step === "done" && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={bouncy}
                  onClick={conversion.editText}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors border border-white/10"
                >
                  <PenLine className="w-4 h-4" />
                  Edit text
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={bouncy}
                onClick={conversion.reset}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors border border-white/10"
              >
                Start Over
              </motion.button>
            </div>
          )}

          {(step === "review" || step === "done") && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl mt-8 flex flex-col gap-6">
              {step === "done" && conversion.playlist.length > 0 && (
                <div ref={playerRef}>
                  <PlaylistPlayer playlist={conversion.playlist} index={conversion.chapterIndex} onIndexChange={conversion.setChapterIndex} cloud={cloud} />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {conversion.pdfUrl && (
                  <Suspense fallback={<div className="h-96 rounded-2xl border border-white/10 bg-black/40" />}>
                    <DocumentPreview url={conversion.pdfUrl} />
                  </Suspense>
                )}
                <ChapterEditor
                  step={step}
                  text={conversion.extractedText}
                  onTextChange={conversion.setExtractedText}
                  suggestions={conversion.suggestions}
                  onAccept={conversion.acceptSuggestion}
                  onAcceptAll={conversion.acceptAllSuggestions}
                  onDismiss={conversion.dismissSuggestion}
                  onDismissAll={conversion.dismissAllSuggestions}
                  onAutoDetect={conversion.redetectSuggestions}
                  onGenerate={conversion.generateAudio}
                />
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
