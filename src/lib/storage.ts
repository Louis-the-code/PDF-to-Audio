import type { AudioFormat } from "./audio";

export const AUDIO_BUCKET = "audio-playlists";

/** Storage path of a chapter. Deterministic, so playback and deletion can derive it from the playlist row. */
export const chapterPath = (userId: string, playlistId: string, index: number, format: string) => `${userId}/${playlistId}/chapter_${index}.${format}`;

export const contentTypeFor = (format: AudioFormat) => (format === "mp3" ? "audio/mpeg" : "audio/wav");

/** How long signed playback URLs stay valid. */
export const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;
