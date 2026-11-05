import { useCallback, useEffect, useRef, useState } from "react";
import type { Voice } from "../../shared/config";
import { api } from "../lib/api";
import { pcmToWav, base64ToBytes } from "../lib/utils";

/** Plays short voice samples, caching the generated audio per voice for the session. */
export function useVoicePreview(onError: (error: unknown) => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef(new Map<Voice, string>());
  const [loadingVoice, setLoadingVoice] = useState<Voice | null>(null);

  useEffect(() => {
    const urls = urlsRef.current;
    const audio = new Audio();
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const play = useCallback(
    async (voice: Voice) => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        let url = urlsRef.current.get(voice);
        if (!url) {
          setLoadingVoice(voice);
          const wav = await pcmToWav(base64ToBytes(await api.previewVoice(voice)), 24000, 1);
          url = URL.createObjectURL(wav);
          urlsRef.current.set(voice, url);
        }
        audio.src = url;
        await audio.play();
      } catch (err) {
        onError(err);
      } finally {
        setLoadingVoice(null);
      }
    },
    [onError],
  );

  return { play, loadingVoice };
}
