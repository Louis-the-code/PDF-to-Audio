import { useCallback, useEffect, useRef, useState } from "react";
import type { GeneratedChapter } from "../lib/audioPipeline";
import type { AudioFormat } from "../lib/audio";
import { supabase } from "../lib/supabase";
import { AUDIO_BUCKET, chapterPath, contentTypeFor } from "../lib/storage";

interface Options {
  playlist: GeneratedChapter[];
  format: AudioFormat;
  title: string | null;
}

/** Uploads the generated chapters to Supabase. Cleans up after a partial failure and prevents duplicate saves. */
export function useCloudSave({ playlist, format, title }: Options) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A new playlist is a new thing to save.
  useEffect(() => {
    setSaved(false);
    setStatus(null);
  }, [playlist]);
  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const save = useCallback(async () => {
    if (!supabase) return setStatus("Supabase is not configured. Please check your environment variables.");
    if (playlist.length === 0) return setStatus("No audio generated yet.");
    if (saving || saved) return;

    setSaving(true);
    setStatus("Saving to cloud...");
    const uploaded: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to save to the cloud.");

      const playlistId = crypto.randomUUID();
      const chapters: { title: string; path: string; order: number }[] = [];

      for (let i = 0; i < playlist.length; i++) {
        const path = chapterPath(user.id, playlistId, i, format);
        setStatus(`Uploading chapter ${i + 1} of ${playlist.length}...`);
        const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, playlist[i].blob, { contentType: contentTypeFor(format) });
        if (error) throw error;
        uploaded.push(path);
        chapters.push({ title: playlist[i].title, path, order: i });
      }

      setStatus("Saving playlist metadata...");
      const row = { id: playlistId, user_id: user.id, created_at: new Date().toISOString(), chapters, format };
      let { error } = await supabase.from("playlists").insert({ ...row, title });
      // Databases created before the `title` column existed: save without it.
      if (error && /title/i.test(error.message)) ({ error } = await supabase.from("playlists").insert(row));
      if (error) throw error;

      setSaved(true);
      setStatus("Successfully saved to cloud!");
      clearTimer.current = setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error("Cloud save error:", err);
      if (uploaded.length > 0) {
        // Don't leave orphaned files behind a playlist row that was never written.
        const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(uploaded);
        if (error) console.error("Failed to clean up partial upload:", error);
      }
      setStatus(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [playlist, format, title, saving, saved]);

  return { save, saving, saved, status };
}
