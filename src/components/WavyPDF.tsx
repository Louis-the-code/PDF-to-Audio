import { AlertCircle, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";
import { useCloudSave } from "../hooks/useCloudSave";
import { useConversion } from "../hooks/useConversion";
import { useSettings } from "../hooks/useSettings";
import { useVoicePreview } from "../hooks/useVoicePreview";
import { errorMessage } from "../lib/errors";
import { fade, panelSwap } from "../lib/motion";
import { ChapterEditor } from "./wavy/ChapterEditor";
import { ListenPanel } from "./wavy/ListenPanel";
import { StatusPanel } from "./wavy/StatusPanel";
import { UploadZone } from "./wavy/UploadZone";
import { VoicePicker } from "./wavy/VoicePicker";

export function WavyPDF() {
  const settings = useSettings();
  const conversion = useConversion(settings);
  const { step, error, setError } = conversion;
  const cloud = useCloudSave({ playlist: conversion.playlist, format: settings.format, title: conversion.fileName });
  const preview = useVoicePreview(useCallback((err: unknown) => setError(errorMessage(err)), [setError]));

  const voicePicker = (
    <VoicePicker
      voice={settings.voice}
      onVoiceChange={settings.setVoice}
      onPreview={preview.play}
      loadingPreviewVoice={preview.loadingVoice}
      format={settings.format}
      onFormatChange={settings.setFormat}
      maxChars={settings.maxChars}
      onMaxCharsChange={settings.setMaxChars}
    />
  );

  const heading = {
    idle: { title: "Turn a PDF into an audiobook.", sub: "Choose a voice, add your document, and listen anywhere." },
    extracting: { title: "Reading your document", sub: "Pulling out the text and spotting chapters." },
    review: { title: "Check the text", sub: "Fix anything that reads oddly and add chapter breaks, then generate." },
    generating: { title: "Recording your audiobook", sub: "You can keep reading the text while the voice works." },
    done: { title: "Your audiobook is ready", sub: "Listen here, download it, or save it to your Library." },
  }[step];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...panelSwap} transition={fade} className="max-w-2xl">
            <h1 className={`font-semibold ${step === "idle" ? "text-4xl leading-[1.05] tracking-[-0.03em] sm:text-6xl" : "text-3xl sm:text-4xl"}`}>{heading.title}</h1>
            <p className="mt-3 text-lg text-mist-muted">{heading.sub}</p>
          </motion.div>
        </AnimatePresence>
        {step !== "idle" && !conversion.isProcessing && (
          <button
            type="button"
            onClick={conversion.reset}
            className="press flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-mist-muted hover:border-white/20 hover:text-mist"
          >
            <RotateCcw className="h-4 w-4" />
            Start Over
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, transform: "translateY(-6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0 }}
            transition={fade}
            className="mb-6 flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3.5 text-danger"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm leading-relaxed">{error}</p>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-danger/10">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {step === "idle" ? (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          <UploadZone onFile={conversion.processFile} />
          {voicePicker}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-6">
          {/* On phones the actions come first; on desktop they sit beside the document. */}
          <div className="order-2 lg:order-1">
            <ChapterEditor
              step={step}
              fileName={conversion.fileName}
              pdfUrl={conversion.pdfUrl}
              text={conversion.extractedText}
              onTextChange={conversion.setExtractedText}
              suggestions={conversion.suggestions}
              onAccept={conversion.acceptSuggestion}
              onDismiss={conversion.dismissSuggestion}
              onDismissAll={conversion.dismissAllSuggestions}
              onAutoDetect={conversion.redetectSuggestions}
            />
          </div>

          <div className="order-1 lg:sticky lg:top-24 lg:order-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} {...panelSwap} transition={fade} className="space-y-5">
                {step === "extracting" && (
                  <StatusPanel title="Reading your PDF" message={conversion.statusMessage} seed={conversion.fileName ?? "doc"} onCancel={conversion.reset} />
                )}
                {step === "review" && (
                  <>
                    {voicePicker}
                    <button
                      type="button"
                      onClick={conversion.generateAudio}
                      className="press flex h-14 w-full items-center justify-center rounded-2xl bg-signal text-base font-semibold text-ink-950 shadow-signal hover:bg-signal-strong"
                    >
                      Generate Audio
                    </button>
                  </>
                )}
                {step === "generating" && (
                  <StatusPanel
                    title="Generating audio"
                    message={conversion.statusMessage}
                    progress={conversion.progress}
                    seed={conversion.fileName ?? "doc"}
                    onCancel={conversion.reset}
                  />
                )}
                {step === "done" && conversion.playlist.length > 0 && (
                  <ListenPanel
                    playlist={conversion.playlist}
                    index={conversion.chapterIndex}
                    onIndexChange={conversion.setChapterIndex}
                    fileName={conversion.fileName}
                    format={settings.format}
                    cloud={cloud}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
