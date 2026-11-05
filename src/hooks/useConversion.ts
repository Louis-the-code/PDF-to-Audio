import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PDF_BYTES, type Voice } from "../../shared/config";
import type { AudioFormat } from "../lib/audio";
import { generateChapters, isAbortError, type GeneratedChapter, type SegmentCache } from "../lib/audioPipeline";
import { acceptChapterSuggestion, detectChapterSuggestions } from "../lib/chapters";
import { extractDocumentText } from "../lib/documentText";
import { errorMessage } from "../lib/errors";

export type Step = "idle" | "extracting" | "review" | "generating" | "done";

const revokeAll = (chapters: GeneratedChapter[]) => chapters.forEach((c) => URL.revokeObjectURL(c.url));

interface Options {
  voice: Voice;
  format: AudioFormat;
  maxChars: number;
}

/** The upload → review → generate → listen workflow, and everything it allocates. */
export function useConversion({ voice, format, maxChars }: Options) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [playlist, setPlaylist] = useState<GeneratedChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);

  /** Aborted whenever a newer run starts or the user cancels, so stale work stops and is ignored. */
  const runRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<SegmentCache>(new Map());
  const liveRef = useRef({ pdfUrl, playlist });
  liveRef.current = { pdfUrl, playlist };

  const releaseResources = useCallback(() => {
    const { pdfUrl: url, playlist: chapters } = liveRef.current;
    if (url) URL.revokeObjectURL(url);
    revokeAll(chapters);
  }, []);

  useEffect(
    () => () => {
      runRef.current?.abort();
      releaseResources();
    },
    [releaseResources],
  );

  const startRun = () => {
    runRef.current?.abort();
    const controller = new AbortController();
    runRef.current = controller;
    return controller;
  };

  const reset = useCallback(() => {
    runRef.current?.abort();
    releaseResources();
    cacheRef.current.clear();
    setStep("idle");
    setError(null);
    setStatusMessage("");
    setFileName(null);
    setPdfUrl(null);
    setExtractedText("");
    setSuggestions([]);
    setPlaylist([]);
    setChapterIndex(0);
  }, [releaseResources]);

  const processFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a valid PDF file.");
        return;
      }
      if (file.size > MAX_PDF_BYTES) {
        setError("File size exceeds the 10MB limit. Please upload a smaller PDF.");
        return;
      }

      const controller = startRun();
      releaseResources();
      cacheRef.current.clear();
      setError(null);
      setPlaylist([]);
      setChapterIndex(0);
      setSuggestions([]);
      setExtractedText("");
      setFileName(file.name.replace(/\.pdf$/i, ""));
      setPdfUrl(URL.createObjectURL(file));
      setStep("extracting");

      try {
        const text = await extractDocumentText(file, (message) => !controller.signal.aborted && setStatusMessage(message));
        if (controller.signal.aborted) return;
        setExtractedText(text);
        setSuggestions(detectChapterSuggestions(text));
        setStep("review");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        // Nothing to review, so go back to the upload screen and show why.
        releaseResources();
        setPdfUrl(null);
        setFileName(null);
        setError(errorMessage(err));
        setStep("idle");
      } finally {
        if (!controller.signal.aborted) setStatusMessage("");
      }
    },
    [releaseResources],
  );

  const generateAudio = useCallback(async () => {
    const controller = startRun();
    setError(null);
    setStep("generating");

    try {
      const chapters = await generateChapters({
        text: extractedText,
        voice,
        format,
        maxChars,
        cache: cacheRef.current,
        signal: controller.signal,
        onStatus: (message) => !controller.signal.aborted && setStatusMessage(message),
      });
      if (controller.signal.aborted) {
        revokeAll(chapters);
        return;
      }
      revokeAll(liveRef.current.playlist);
      setPlaylist(chapters);
      setChapterIndex(0);
      setStep("done");
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) return;
      console.error(err);
      // Stay in review: the text is intact and finished segments are cached, so retrying resumes.
      setError(errorMessage(err));
      setStep("review");
    } finally {
      if (!controller.signal.aborted) setStatusMessage("");
    }
  }, [extractedText, voice, format, maxChars]);

  const acceptSuggestion = useCallback((heading: string) => {
    setExtractedText((text) => acceptChapterSuggestion(text, heading));
    setSuggestions((list) => list.filter((s) => s !== heading));
  }, []);

  const dismissSuggestion = useCallback((heading: string) => setSuggestions((list) => list.filter((s) => s !== heading)), []);
  const dismissAllSuggestions = useCallback(() => setSuggestions([]), []);
  const redetectSuggestions = useCallback(() => setSuggestions(detectChapterSuggestions(extractedText)), [extractedText]);

  return {
    step,
    isProcessing: step === "extracting" || step === "generating",
    error,
    setError,
    statusMessage,
    fileName,
    pdfUrl,
    extractedText,
    setExtractedText,
    suggestions,
    playlist,
    chapterIndex,
    setChapterIndex,
    audioUrl: playlist[chapterIndex]?.url ?? null,
    processFile,
    generateAudio,
    reset,
    acceptSuggestion,
    dismissSuggestion,
    dismissAllSuggestions,
    redetectSuggestions,
  };
}
