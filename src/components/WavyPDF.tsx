import React, { useEffect, useRef, useState, ChangeEvent } from "react";
import { motion } from "motion/react";
import { Upload, AlertCircle, Volume2, Loader2, SkipBack, SkipForward, Cloud } from "lucide-react";
import { AnimatedDownloadButton } from "./ui/AnimatedDownloadButton";
import { CustomAudioPlayer } from "./ui/CustomAudioPlayer";
import { pcmToWav, pcmToMp3 } from "../lib/utils";
import { GoogleGenAI, Modality } from "@google/genai";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { supabase } from "../lib/supabase";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const getFriendlyErrorMessage = (error: any): string => {
  const errorString = error?.message || String(error);
  
  if (errorString.includes("API key not valid") || errorString.includes("API_KEY_INVALID")) {
    return "Invalid API key. Please check your GEMINI_API_KEY in the Settings menu.";
  }
  if (errorString.includes("Quota exceeded") || errorString.includes("429") || errorString.includes("Too Many Requests")) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }
  if (errorString.includes("mimeType") || errorString.includes("unsupported") || errorString.includes("invalid argument")) {
    return "Unsupported file type or content. Please ensure you uploaded a valid PDF.";
  }
  if (errorString.includes("fetch failed") || errorString.includes("network")) {
    return "Network error connecting to the AI service. Please check your connection and try again.";
  }
  if (errorString.includes("Failed to generate audio for chunk")) {
    return "Failed to generate audio for a segment. The text might contain unsupported characters or the service is temporarily unavailable.";
  }
  
  return errorString || "An unexpected error occurred during processing.";
};

export function WavyPDF() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasFile, setHasFile] = useState(false);
  const [step, setStep] = useState<'idle' | 'extracting' | 'review' | 'generating' | 'done'>('idle');
  const [extractedText, setExtractedText] = useState("");
  const [suggestedChapters, setSuggestedChapters] = useState<{text: string}[]>([]);
  const [playlist, setPlaylist] = useState<{title: string, url: string, blob?: Blob}[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<string | null>(null);

  const detectChapters = (text: string) => {
    const lines = text.split('\n');
    const suggestions: {text: string}[] = [];
    const regex = /^(?:Chapter|Section|Part)\s+(?:\d+|[IVX]+|[A-Z])(?:[\s.:-]|$).{0,80}$/i;
    const regexNumber = /^\d+\.\s+[A-Z].{0,80}$/;
    
    const uniqueSuggestions = new Set<string>();

    lines.forEach((line) => {
      const trimmed = line.trim();
      if ((regex.test(trimmed) || regexNumber.test(trimmed)) && !trimmed.includes('[CHAPTER:')) {
        if (!uniqueSuggestions.has(trimmed)) {
          uniqueSuggestions.add(trimmed);
          suggestions.push({ text: trimmed });
        }
      }
    });
    setSuggestedChapters(suggestions);
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('wavy_voice') || 'Kore');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'wav'>(() => (localStorage.getItem('wavy_format') as 'mp3' | 'wav') || 'mp3');
  const [maxChars, setMaxChars] = useState<number>(() => {
    const saved = localStorage.getItem('wavy_maxChars');
    return saved ? parseInt(saved, 10) : 4000;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const [loadingPreviewVoice, setLoadingPreviewVoice] = useState<string | null>(null);
  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);
  
  const voiceGroups = [
    { category: 'Male', voices: ['Puck', 'Charon', 'Fenrir'] },
    { category: 'Female', voices: ['Kore', 'Aoede', 'Zephyr'] }
  ];

  useEffect(() => {
    localStorage.setItem('wavy_voice', selectedVoice);
    localStorage.setItem('wavy_format', audioFormat);
    localStorage.setItem('wavy_maxChars', maxChars.toString());
  }, [selectedVoice, audioFormat, maxChars]);

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

    setLoadingPreviewVoice(voice);
    try {
      const text = `Hello, my name is ${voice}.`;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const audioResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Failed to generate audio");

      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const wavBlob = await pcmToWav(bytes, 24000, 1);
      const url = URL.createObjectURL(wavBlob);

      setPreviewCache(prev => ({ ...prev, [voice]: url }));

      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = url;
        audioPreviewRef.current.play().catch(console.error);
      }
    } catch (err: any) {
      console.error("Preview error:", err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoadingPreviewVoice(null);
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

    // Helper to generate random colors
    const randomColors = (count: number) => {
      const colors = [];
      for (let i = 0; i < count; i++) {
        colors.push('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
      }
      return colors;
    };

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
    setStep('extracting');
    setError(null);
    setPdfFileUrl(URL.createObjectURL(file));

    const chunkText = (text: string, maxLen: number): string[] => {
      const chunks: string[] = [];
      let currentIndex = 0;
      while (currentIndex < text.length) {
        let nextIndex = currentIndex + maxLen;
        if (nextIndex < text.length) {
          const lastPeriod = text.lastIndexOf('.', nextIndex);
          if (lastPeriod > currentIndex) {
            nextIndex = lastPeriod + 1;
          } else {
            const lastSpace = text.lastIndexOf(' ', nextIndex);
            if (lastSpace > currentIndex) {
              nextIndex = lastSpace + 1;
            }
          }
        }
        chunks.push(text.substring(currentIndex, nextIndex).trim());
        currentIndex = nextIndex;
      }
      return chunks.filter(c => c.length > 0);
    };

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          setStatusMessage("Extracting text from PDF...");
          let extractedText = "";
          
          try {
            const extractWithRetry = async (retries = 3): Promise<string> => {
              try {
                const textResponse = await ai.models.generateContent({
                  model: "gemini-3.1-pro-preview",
                  contents: [
                    {
                      role: "user",
                      parts: [
                        { text: "You are an expert document parser. Extract the main text from this document so it can be read aloud as an audiobook. Follow these rules strictly:\n1. Read in the correct logical order (top-to-bottom, left-to-right within columns).\n2. Exclude page numbers, headers, footers, and complex data tables.\n3. Expand special characters, acronyms, and symbols so they sound natural when spoken (e.g., '$50' becomes 'fifty dollars', '&' becomes 'and').\n4. Format the output as clean, continuous text with appropriate paragraph breaks.\n5. If there are clear section or chapter headings, preserve them and prefix them with '[CHAPTER: Title]' to help with chapter navigation." },
                        { inlineData: { data: base64Data, mimeType: "application/pdf" } }
                      ]
                    }
                  ]
                });
                return textResponse.text || "";
              } catch (err: any) {
                if (retries > 0) {
                  const errorMsg = err?.message?.toLowerCase() || "";
                  const isRateLimit = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("exhausted");
                  const delay = isRateLimit ? (4 - retries) * 15000 : 2000;
                  console.warn(`Extraction failed, retrying in ${delay}ms... (${retries} left)`, err);
                  setStatusMessage(`Rate limit reached. Waiting ${delay / 1000}s before retrying...`);
                  await new Promise(r => setTimeout(r, delay));
                  setStatusMessage("Extracting text from PDF...");
                  return extractWithRetry(retries - 1);
                }
                throw err;
              }
            };
            
            extractedText = await extractWithRetry();
          } catch (e) {
            console.warn("Gemini extraction failed, falling back to pdfjs", e);
          }

          if (!extractedText || extractedText.trim().length === 0) {
            setStatusMessage("Falling back to local text extraction...");
            try {
              const arrayBuffer = await file.arrayBuffer();
              const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
              const numPages = pdf.numPages;
              let fullText = '';
              for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Sort items by Y (descending) then X (ascending) to approximate reading order
                const items = textContent.items as any[];
                items.sort((a, b) => {
                  const yA = a.transform[5];
                  const yB = b.transform[5];
                  if (Math.abs(yA - yB) < 5) {
                    return a.transform[4] - b.transform[4];
                  }
                  return yB - yA;
                });
                
                let pageText = '';
                let lastY = null;
                for (const item of items) {
                  if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
                    pageText += '\n';
                  }
                  pageText += item.str + ' ';
                  lastY = item.transform[5];
                }
                
                fullText += pageText + '\n\n';
              }
              
              setStatusMessage("Cleaning up extracted text...");
              // Use Gemini to clean up the raw pdfjs text, fixing columns and special chars
              try {
                const cleanupWithRetry = async (retries = 3): Promise<string> => {
                  try {
                    const cleanupResponse = await ai.models.generateContent({
                      model: "gemini-3.1-pro-preview",
                      contents: `I have extracted raw text from a PDF, but the layout, columns, and special characters might be messed up. Please clean it up for audiobook narration.
                      
Rules:
1. Fix any column interleaving issues or broken sentences.
2. Exclude page numbers, headers, footers, and complex data tables.
3. Expand special characters, acronyms, and symbols so they sound natural when spoken.
4. Format the output as clean, continuous text with appropriate paragraph breaks.
5. If there are clear section or chapter headings, preserve them and prefix them with '[CHAPTER: Title]'.

Raw Text:
${fullText.substring(0, 100000)}` // Reduced to 100k chars to prevent payload too large errors
                    });
                    return cleanupResponse.text || fullText;
                  } catch (err: any) {
                    if (retries > 0) {
                      const errorMsg = err?.message?.toLowerCase() || "";
                      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("exhausted");
                      const delay = isRateLimit ? (4 - retries) * 15000 : 2000;
                      console.warn(`Cleanup failed, retrying in ${delay}ms... (${retries} left)`, err);
                      setStatusMessage(`Rate limit reached. Waiting ${delay / 1000}s before retrying...`);
                      await new Promise(r => setTimeout(r, delay));
                      setStatusMessage("Cleaning up extracted text...");
                      return cleanupWithRetry(retries - 1);
                    }
                    throw err;
                  }
                };
                
                extractedText = await cleanupWithRetry();
              } catch (e) {
                console.warn("Gemini cleanup failed, using raw pdfjs text", e);
                extractedText = fullText;
              }
              
            } catch (localErr) {
              console.error("Local extraction also failed:", localErr);
            }
          }

          if (!extractedText || extractedText.trim().length === 0) {
            throw new Error("Failed to extract text from PDF. The document might be empty or scanned as images.");
          }

          setExtractedText(extractedText);
          detectChapters(extractedText);
          setStep('review');
          setIsProcessing(false);
          setStatusMessage("");
          
        } catch (err: any) {
          console.error(err);
          setError(getFriendlyErrorMessage(err));
          setIsProcessing(false);
          setStep('idle');
          setStatusMessage("");
        }
      };
      reader.onerror = () => {
        setError("Failed to read file");
        setIsProcessing(false);
        setStep('idle');
        setStatusMessage("");
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
      setIsProcessing(false);
      setStep('idle');
      setStatusMessage("");
    }
  };

  const chunkText = (text: string, maxLen: number): string[] => {
    const chunks: string[] = [];
    let currentIndex = 0;
    while (currentIndex < text.length) {
      let nextIndex = currentIndex + maxLen;
      if (nextIndex < text.length) {
        const lastPeriod = text.lastIndexOf('.', nextIndex);
        if (lastPeriod > currentIndex) {
          nextIndex = lastPeriod + 1;
        } else {
          const lastSpace = text.lastIndexOf(' ', nextIndex);
          if (lastSpace > currentIndex) {
            nextIndex = lastSpace + 1;
          }
        }
      }
      chunks.push(text.substring(currentIndex, nextIndex).trim());
      currentIndex = nextIndex;
    }
    return chunks.filter(c => c.length > 0);
  };

  const generateAudio = async () => {
    setStep('generating');
    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Parse chapters
      const chapterRegex = /\[CHAPTER:\s*(.*?)\]/g;
      const chapters: { title: string, text: string }[] = [];
      let lastIndex = 0;
      let currentTitle = "Introduction";
      
      let match;
      while ((match = chapterRegex.exec(extractedText)) !== null) {
        if (match.index > lastIndex) {
          const text = extractedText.substring(lastIndex, match.index).trim();
          if (text) {
            chapters.push({ title: currentTitle, text });
          }
        }
        currentTitle = match[1];
        lastIndex = match.index + match[0].length;
      }
      
      const remainingText = extractedText.substring(lastIndex).trim();
      if (remainingText) {
        chapters.push({ title: currentTitle, text: remainingText });
      }

      if (chapters.length === 0) {
        chapters.push({ title: "Full Document", text: extractedText });
      }

      const newPlaylist: {title: string, url: string, blob: Blob}[] = [];
      let totalChunks = 0;
      const chapterChunks = chapters.map(ch => {
        const chunks = chunkText(ch.text, maxChars);
        totalChunks += chunks.length;
        return { ...ch, chunks };
      });

      setStatusMessage(`Generating audio for ${totalChunks} segments across ${chapters.length} chapters...`);
      
      let completedCount = 0;

      const processChunk = async (chunk: string, retries = 5): Promise<Int16Array> => {
        try {
          const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: chunk }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          });
          
          const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!base64Audio) throw new Error(`Failed to generate audio for chunk`);

          const binary = atob(base64Audio);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) {
            bytes[j] = binary.charCodeAt(j);
            if (j % 100000 === 0) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
          
          return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
        } catch (error: any) {
          if (retries > 0) {
            const errorMsg = error?.message?.toLowerCase() || "";
            const isRateLimit = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("exhausted");
            // Wait 15s for rate limits, 2s for other errors. Increase delay on subsequent retries.
            const delay = isRateLimit ? (6 - retries) * 15000 : 2000; 
            
            console.warn(`TTS generation failed, retrying in ${delay}ms... (${retries} attempts left)`, error);
            setStatusMessage(`Rate limit reached. Waiting ${delay / 1000}s before retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            setStatusMessage(`Generating audio for ${totalChunks} segments across ${chapters.length} chapters...`);
            return processChunk(chunk, retries - 1);
          }
          throw error;
        }
      };

      for (const chapter of chapterChunks) {
        const results: Int16Array[] = new Array(chapter.chunks.length);
        let currentIndex = 0;

        const worker = async () => {
          while (currentIndex < chapter.chunks.length) {
            const index = currentIndex++;
            results[index] = await processChunk(chapter.chunks[index]);
            completedCount++;
            setStatusMessage(`Generated audio chunk ${completedCount} of ${totalChunks}...`);
          }
        };

        const workers = [];
        const concurrencyLimit = 1; // Reduced concurrency to prevent XHR/500 errors
        for (let i = 0; i < Math.min(concurrencyLimit, chapter.chunks.length); i++) {
          workers.push(worker());
        }
        
        await Promise.all(workers);

        const silenceSamples = new Int16Array(12000);
        const totalLength = results.reduce((acc, curr) => acc + curr.length + silenceSamples.length, 0);
        const mergedPcm = new Int16Array(totalLength);
        let offset = 0;
        
        for (let i = 0; i < results.length; i++) {
          const pcmChunk = results[i];
          mergedPcm.set(pcmChunk, offset);
          offset += pcmChunk.length;
          mergedPcm.set(silenceSamples, offset);
          offset += silenceSamples.length;
          
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        setStatusMessage(`Finalizing chapter: ${chapter.title}...`);
        const finalBytes = new Uint8Array(mergedPcm.buffer);
        const audioBlob = audioFormat === 'mp3' ? await pcmToMp3(finalBytes, 24000, 1) : await pcmToWav(finalBytes, 24000, 1);
        const url = URL.createObjectURL(audioBlob);
        
        newPlaylist.push({ title: chapter.title, url, blob: audioBlob });
      }

      setPlaylist(newPlaylist);
      setCurrentChapterIndex(0);
      setAudioUrl(newPlaylist[0].url);
      setStep('done');
      setIsProcessing(false);
      setStatusMessage("");

    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
      setIsProcessing(false);
      setStep('review');
      setStatusMessage("");
    }
  };

  const saveToCloud = async () => {
    if (!supabase) {
      setCloudSaveStatus("Supabase is not configured. Please check your environment variables.");
      return;
    }

    if (playlist.length === 0) {
      setCloudSaveStatus("No audio generated yet.");
      return;
    }

    setIsSavingToCloud(true);
    setCloudSaveStatus("Saving to cloud...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to save to the cloud.");

      const playlistId = crypto.randomUUID();
      const uploadedChapters = [];

      for (let i = 0; i < playlist.length; i++) {
        const chapter = playlist[i];
        if (!chapter.blob) continue;

        // Save to a user-specific folder
        const fileName = `${user.id}/${playlistId}/chapter_${i}.${audioFormat}`;
        setCloudSaveStatus(`Uploading chapter ${i + 1} of ${playlist.length}...`);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('audio-playlists')
          .upload(fileName, chapter.blob, {
            contentType: audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('audio-playlists')
          .getPublicUrl(fileName);

        uploadedChapters.push({
          title: chapter.title,
          url: publicUrlData.publicUrl,
          order: i
        });
      }

      setCloudSaveStatus("Saving playlist metadata...");
      const { error: dbError } = await supabase
        .from('playlists')
        .insert({
          id: playlistId,
          user_id: user.id,
          created_at: new Date().toISOString(),
          chapters: uploadedChapters,
          format: audioFormat
        });

      if (dbError) throw dbError;

      setCloudSaveStatus("Successfully saved to cloud!");
      setTimeout(() => setCloudSaveStatus(null), 3000);
    } catch (err: any) {
      console.error("Cloud save error:", err);
      setCloudSaveStatus(`Failed to save: ${err.message}`);
    } finally {
      setIsSavingToCloud(false);
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
      className="relative min-h-screen w-full bg-transparent flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Tubes Cursor Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block h-full w-full pointer-events-none" />

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
          className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6 flex gap-3 md:gap-4 justify-center cursor-default"
        >
          {["PDF", "to", "Audio."].map((word, i) => (
            <motion.span
              key={i}
              whileHover={{ 
                scale: 1.1, 
                rotate: i % 2 === 0 ? 2 : -2,
                textShadow: "0px 0px 20px rgba(255,255,255,0.8)" 
              }}
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

        {/* Settings Panel */}
        {!hasFile && !error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl mb-8 p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-6"
          >
            {/* Voice Selection */}
            <div>
              <label className="text-sm font-medium text-white/80 mb-4 block">Voice Persona</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {voiceGroups.map(group => (
                  <div key={group.category} className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider pl-1">
                      {group.category} Voices
                    </span>
                    <div className="flex flex-col gap-2">
                      {group.voices.map(voice => (
                        <div
                          key={voice}
                          onClick={() => setSelectedVoice(voice)}
                          className={`relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                            selectedVoice === voice 
                              ? 'bg-white/10 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                              : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/15'
                          }`}
                        >
                          <span className={`text-sm font-medium ${selectedVoice === voice ? 'text-white' : 'text-white/70'}`}>
                            {voice}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoicePreview(voice);
                            }}
                            disabled={loadingPreviewVoice === voice}
                            className={`p-2 rounded-full transition-colors ${
                              selectedVoice === voice 
                                ? 'bg-white/20 text-white hover:bg-white/30' 
                                : 'bg-white/5 text-white/50 hover:bg-white/15 hover:text-white'
                            }`}
                            title={`Preview ${voice}`}
                          >
                            {loadingPreviewVoice === voice ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Audio Format */}
              <div>
                <label className="text-sm font-medium text-white/80 mb-3 block">Audio Format</label>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                  <button 
                    onClick={() => setAudioFormat('mp3')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      audioFormat === 'mp3' ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    MP3
                  </button>
                  <button 
                    onClick={() => setAudioFormat('wav')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      audioFormat === 'wav' ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    WAV
                  </button>
                </div>
              </div>

              {/* Chunk Size Slider */}
              <div>
                <div className="flex justify-between items-end mb-3">
                  <label className="text-sm font-medium text-white/80">Segment Size</label>
                  <span className="text-xs font-mono text-white/50 bg-black/40 px-2 py-1 rounded-md">{maxChars} chars</span>
                </div>
                <div className="relative pt-2">
                  <input
                    type="range"
                    min="1000"
                    max="10000"
                    step="500"
                    value={maxChars}
                    onChange={(e) => setMaxChars(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 mt-2 px-1 font-mono">
                    <span>1k</span>
                    <span>10k</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Upload & Download Actions */}
        <motion.div 
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-8 w-full"
        >
          <div className="flex flex-col sm:flex-row gap-6 items-center w-full max-w-2xl justify-center">
            <input 
              type="file" 
              accept=".pdf,application/pdf" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleUpload} 
            />
            {error ? (
              <motion.div
                layout
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
                    setPdfFileUrl(null);
                  }}
                  className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium transition-colors border border-white/10"
                >
                  Try Again
                </motion.button>
              </motion.div>
            ) : !hasFile ? (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex flex-col items-center justify-center gap-6 p-12 w-full rounded-[2rem] border-2 border-dashed transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                  isDragging 
                    ? "border-white bg-white/10 shadow-[0_0_40px_rgba(255,255,255,0.2)]" 
                    : "border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/30 shadow-2xl shadow-black/50"
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {isDragging && (
                  <>
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"
                      animate={{ opacity: [0.3, 0.8, 0.3], y: [-20, 0, -20] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div 
                      className="absolute inset-0 pointer-events-none"
                      style={{ boxShadow: "inset 0 0 50px rgba(255,255,255,0.1)" }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </>
                )}
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={triggerFileInput}
                  className={`flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-semibold hover:bg-white/90 transition-all shadow-glow-white cursor-pointer z-10 ${
                    isDragging ? "scale-110 shadow-[0_0_30px_rgba(255,255,255,0.8)]" : ""
                  }`}
                >
                  <motion.div
                    animate={isDragging ? { y: [-3, 3, -3] } : {}}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Upload className="w-5 h-5" />
                  </motion.div>
                  {isDragging ? "Drop PDF Here" : "Select PDF"}
                </motion.button>
                <p className={`text-sm transition-colors duration-300 z-10 ${isDragging ? "text-white font-medium" : "text-white/40"}`}>
                  {isDragging ? "Release to upload" : "or drag and drop your PDF here"}
                </p>
              </motion.div>
            ) : (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnimatedDownloadButton 
                  isProcessing={isProcessing} 
                  audioUrl={audioUrl} 
                  error={error} 
                  statusMessage={statusMessage}
                  format={audioFormat}
                />
              </motion.div>
            )}
          </div>

          {/* Audio Player & Preview */}
          {hasFile && !error && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl mt-8 flex flex-col gap-6"
            >
              {step === 'done' && playlist.length > 0 && (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-2xl mx-auto p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col gap-5"
                >
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-white font-semibold text-xl">Audio Chapters</h3>
                    <div className="flex items-center gap-3">
                      {cloudSaveStatus && (
                        <motion.span 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs text-blue-400 animate-pulse font-medium"
                        >
                          {cloudSaveStatus}
                        </motion.span>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={saveToCloud}
                        disabled={isSavingToCloud}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 rounded-full text-sm font-bold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/10"
                      >
                        {isSavingToCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                        Save to Cloud
                      </motion.button>
                      <span className="text-xs font-medium text-white/50 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                        {currentChapterIndex + 1} of {playlist.length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-2xl border border-white/5">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (currentChapterIndex > 0) {
                          setCurrentChapterIndex(prev => prev - 1);
                          setAudioUrl(playlist[currentChapterIndex - 1].url);
                        }
                      }}
                      disabled={currentChapterIndex === 0}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors text-white"
                    >
                      <SkipBack className="w-5 h-5" />
                    </motion.button>
                    
                    <div className="relative flex-1 group">
                      <select
                        value={currentChapterIndex}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setCurrentChapterIndex(idx);
                          setAudioUrl(playlist[idx].url);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pl-4 pr-10 text-sm text-white outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer group-hover:bg-white/10 transition-colors"
                      >
                        {playlist.map((chapter, idx) => (
                          <option key={idx} value={idx} className="bg-zinc-900 text-white">
                            {idx + 1}. {chapter.title}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/70 transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                    
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (currentChapterIndex < playlist.length - 1) {
                          setCurrentChapterIndex(prev => prev + 1);
                          setAudioUrl(playlist[currentChapterIndex + 1].url);
                        }
                      }}
                      disabled={currentChapterIndex === playlist.length - 1}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-colors text-white"
                    >
                      <SkipForward className="w-5 h-5" />
                    </motion.button>
                  </div>

                  <div className="pt-2">
                    <CustomAudioPlayer 
                      src={audioUrl || undefined} 
                      autoPlay
                      onEnded={() => {
                        if (currentChapterIndex < playlist.length - 1) {
                          setCurrentChapterIndex(prev => prev + 1);
                          setAudioUrl(playlist[currentChapterIndex + 1].url);
                        }
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {pdfFileUrl && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-white/80 font-medium text-sm px-2">Document Preview</h3>
                    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 h-96 relative flex items-center justify-center">
                      <div className="w-full h-full overflow-y-auto overflow-x-hidden flex justify-center p-4">
                        <Document 
                          file={pdfFileUrl}
                          loading={<Loader2 className="w-6 h-6 text-white/30 animate-spin my-auto" />}
                          error={<span className="text-white/50 text-sm my-auto">Failed to load preview</span>}
                        >
                          <Page 
                            pageNumber={1} 
                            renderTextLayer={false} 
                            renderAnnotationLayer={false}
                            width={320}
                            className="rounded-lg overflow-hidden shadow-lg"
                          />
                        </Document>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-white/80 font-medium text-sm">Review & Edit Chapters</h3>
                      {step === 'review' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => detectChapters(extractedText)}
                            className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-full hover:bg-white/20 transition-colors"
                          >
                            Auto-Detect
                          </button>
                          <button
                            onClick={generateAudio}
                            className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-white/90 transition-colors"
                          >
                            Generate Audio
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 h-96 overflow-hidden relative flex flex-col">
                      {step === 'extracting' ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                          <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                          <span className="text-sm text-white/50">Extracting text...</span>
                        </div>
                      ) : step === 'review' || step === 'generating' || step === 'done' ? (
                        <>
                          <div className="p-3 bg-black/40 border-b border-white/10 text-xs text-white/50 leading-relaxed">
                            Insert <code className="bg-white/10 px-1 py-0.5 rounded text-white/80">[CHAPTER: Title]</code> to split the audio into sections.
                          </div>
                          
                          {suggestedChapters.length > 0 && step === 'review' && (
                            <div className="p-3 bg-blue-500/10 border-b border-blue-500/20 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-blue-400 font-medium">Suggested Chapter Breaks:</span>
                                <button onClick={() => setSuggestedChapters([])} className="text-xs text-blue-400/70 hover:text-blue-400">Dismiss All</button>
                              </div>
                              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                {suggestedChapters.map((sug, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-blue-500/20 text-xs text-white/80">
                                    <span className="truncate max-w-[200px]" title={sug.text}>{sug.text}</span>
                                    <button 
                                      onClick={() => {
                                        setExtractedText(prev => prev.replace(sug.text, `[CHAPTER: ${sug.text}]`));
                                        setSuggestedChapters(prev => prev.filter(s => s.text !== sug.text));
                                      }}
                                      className="text-green-400 hover:text-green-300 font-medium px-1"
                                    >
                                      Accept
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setSuggestedChapters(prev => prev.filter(s => s.text !== sug.text));
                                      }}
                                      className="text-red-400 hover:text-red-300 font-medium px-1"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <textarea
                            value={extractedText}
                            onChange={(e) => setExtractedText(e.target.value)}
                            disabled={step !== 'review'}
                            className="w-full flex-1 bg-transparent p-4 text-sm text-white/80 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
                            placeholder="Extracted text will appear here..."
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
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
