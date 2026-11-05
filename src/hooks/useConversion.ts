import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_PDF_BYTES, type Voice } from "../../shared/config";
import type { AudioFormat } from "../lib/audio";
import { createGenerationCache, generateChapters, isAbortError, planChapters, type GeneratedChapter } from "../lib/audioPipeline";
import { acceptChapterSuggestion, autoMarkChapters, detectChapterSuggestions } from "../lib/chapters";
import { extractDocumentText } from "../lib/documentText";
import { errorMessage } from "../lib/errors";

export type Step = "idle" | "extracting" | "review" | "generating" | "done";

export type ChapterState = "waiting" | "working" | "ready";

export interface Progress {
  stage: "reading" | "voicing";
  done: number;
  total: number;
}

const revokeAll = (chapters: (GeneratedChapter | undefined)[]) => chapters.forEach((c) => c && URL.revokeObjectURL(c.url));

interface Options {
  voice: Voice;
  format: AudioFormat;
  maxChars: number;
  /** Stop after reading so the text can be checked before voicing. Off = one step. */
  reviewFirst: boolean;
}

/** The upload → (review) → voice → listen workflow, and everything it allocates. */
export function useConversion({ voice, format, maxChars, reviewFirst }: Options) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  /** One slot per planned chapter; filled as each becomes playable. */
  const [chapters, setChapters] = useState<(GeneratedChapter | undefined)[]>([]);
  const [outline, setOutline] = useState<{ title: string; state: ChapterState }[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);

  /** Aborted whenever a newer run starts or the user cancels, so stale work stops and is ignored. */
  const runRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(createGenerationCache());
  const liveRef = useRef({ pdfUrl, chapters });
  liveRef.current = { pdfUrl, chapters };
  /** The text to voice when generation is started without one passed in. */
  const textRef = useRef(extractedText);
  textRef.current = extractedText;
  // Read at call time, so voicing that starts automatically after reading uses current settings.
  const settingsRef = useRef({ voice, format, maxChars, reviewFirst });
  settingsRef.current = { voice, format, maxChars, reviewFirst };

  /** Chapters you can play now: the finished ones from the start, in order. */
  const playlist = useMemo(() => {
    const ready: GeneratedChapter[] = [];
    for (const chapter of chapters) {
      if (!chapter) break;
      ready.push(chapter);
    }
    return ready;
  }, [chapters]);

  const releaseResources = useCallback(() => {
    const { pdfUrl: url, chapters: made } = liveRef.current;
    if (url) URL.revokeObjectURL(url);
    revokeAll(made);
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
    cacheRef.current = createGenerationCache();
    setStep("idle");
    setError(null);
    setStatusMessage("");
    setProgress(null);
    setFileName(null);
    setPdfUrl(null);
    setExtractedText("");
    setSuggestions([]);
    setChapters([]);
    setOutline([]);
    setChapterIndex(0);
  }, [releaseResources]);

  const generateAudio = useCallback(async (textOverride?: string) => {
    const text = textOverride ?? textRef.current;
    const { voice: v, format: f, maxChars: m } = settingsRef.current;
    const controller = startRun();
    const live = (fn: () => void) => !controller.signal.aborted && fn();

    revokeAll(liveRef.current.chapters);
    const plan = planChapters(text);
    setError(null);
    setChapters(new Array(plan.length).fill(undefined));
    setOutline(plan.map((c) => ({ title: c.title, state: "waiting" as const })));
    setChapterIndex(0);
    setProgress({ stage: "voicing", done: 0, total: 1 });
    setStep("generating");

    const setState = (index: number, state: ChapterState) =>
      setOutline((list) => list.map((item, i) => (i === index ? { ...item, state } : item)));

    try {
      await generateChapters({
        text,
        voice: v,
        format: f,
        maxChars: m,
        cache: cacheRef.current,
        signal: controller.signal,
        onStatus: (message) => live(() => setStatusMessage(message)),
        onProgress: (done, total) => live(() => setProgress({ stage: "voicing", done, total })),
        onChapterStarted: (index) => live(() => setState(index, "working")),
        onChapterReady: (index, chapter) =>
          live(() => {
            setChapters((list) => list.map((c, i) => (i === index ? chapter : c)));
            setState(index, "ready");
          }),
      });
      live(() => {
        setStep("done");
        setProgress(null);
      });
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) return;
      console.error(err);
      // Back to the text: finished chapters are cached, so trying again resumes.
      setChapters([]);
      setError(errorMessage(err));
      setProgress(null);
      setStep("review");
    } finally {
      live(() => setStatusMessage(""));
    }
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a valid PDF file.");
        return;
      }
      if (file.size > MAX_PDF_BYTES) {
        setError(`This PDF is over ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB. Please upload a smaller file.`);
        return;
      }

      const controller = startRun();
      releaseResources();
      cacheRef.current = createGenerationCache();
      setError(null);
      setChapters([]);
      setOutline([]);
      setChapterIndex(0);
      setSuggestions([]);
      setExtractedText("");
      setFileName(file.name.replace(/\.pdf$/i, ""));
      setPdfUrl(URL.createObjectURL(file));
      setProgress({ stage: "reading", done: 0, total: 1 });
      setStep("extracting");

      let text: string;
      try {
        const raw = await extractDocumentText(file, {
          onStatus: (message) => !controller.signal.aborted && setStatusMessage(message),
          onProgress: (done, total) => !controller.signal.aborted && setProgress({ stage: "reading", done, total }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        // Chapter breaks are applied automatically; nothing to accept one by one.
        text = autoMarkChapters(raw).text;
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        console.error(err);
        // Nothing to work with, so go back to the upload screen and show why.
        releaseResources();
        setPdfUrl(null);
        setFileName(null);
        setError(errorMessage(err));
        setProgress(null);
        setStatusMessage("");
        setStep("idle");
        return;
      }

      setExtractedText(text);
      if (settingsRef.current.reviewFirst) {
        setProgress(null);
        setStatusMessage("");
        setStep("review");
      } else {
        void generateAudio(text);
      }
    },
    [releaseResources, generateAudio],
  );

  /** From the finished audio back to the text, to fix something and re-voice it. */
  const editText = useCallback(() => {
    setSuggestions([]);
    setStep("review");
  }, []);

  const acceptSuggestion = useCallback((heading: string) => {
    setExtractedText((text) => acceptChapterSuggestion(text, heading));
    setSuggestions((list) => list.filter((s) => s !== heading));
  }, []);

  const acceptAllSuggestions = useCallback(() => {
    setExtractedText((text) => suggestions.reduce((out, heading) => acceptChapterSuggestion(out, heading), text));
    setSuggestions([]);
  }, [suggestions]);

  const dismissSuggestion = useCallback((heading: string) => setSuggestions((list) => list.filter((s) => s !== heading)), []);
  const dismissAllSuggestions = useCallback(() => setSuggestions([]), []);
  const redetectSuggestions = useCallback(() => setSuggestions(detectChapterSuggestions(extractedText)), [extractedText]);

  return {
    step,
    isProcessing: step === "extracting" || step === "generating",
    error,
    setError,
    statusMessage,
    progress,
    fileName,
    pdfUrl,
    extractedText,
    setExtractedText,
    suggestions,
    outline,
    playlist,
    chapterIndex,
    setChapterIndex,
    audioUrl: playlist[chapterIndex]?.url ?? null,
    processFile,
    generateAudio: () => generateAudio(),
    editText,
    reset,
    acceptSuggestion,
    acceptAllSuggestions,
    dismissSuggestion,
    dismissAllSuggestions,
    redetectSuggestions,
  };
}
