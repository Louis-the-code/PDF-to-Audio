import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trash2, Play, AudioLines, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioPlayer } from './ui/AudioPlayer';
import { seededPeaks } from '../lib/peaks';
import { fade, spring } from '../lib/motion';
import { AUDIO_BUCKET, SIGNED_URL_TTL_SECONDS, chapterPath } from '../lib/storage';
import { errorMessage } from '../lib/errors';

interface Chapter {
  title: string;
  order: number;
  /** Present on playlists saved by older versions; playback no longer relies on it. */
  url?: string;
  path?: string;
}

interface Playlist {
  id: string;
  user_id: string;
  created_at: string;
  format: string;
  title?: string | null;
  chapters: Chapter[];
}

const playlistTitle = (p: Playlist) => p.title || p.chapters[0]?.title || 'Audiobook';

/** A small cover made from the audiobook's own (decorative) wave. */
function Cover({ seed, size = 52 }: { seed: string; size?: number }) {
  const bars = useMemo(() => seededPeaks(seed, 9), [seed]);
  return (
    <span className="grid shrink-0 place-items-center rounded-2xl bg-ink-800 ring-1 ring-white/[0.06]" style={{ width: size, height: size }} aria-hidden>
      <span className="flex h-1/2 items-center gap-[3px]">
        {bars.map((b, i) => (
          <span key={i} className="w-[3px] rounded-full bg-gradient-to-t from-signal to-amber" style={{ height: `${Math.round(b * 100)}%` }} />
        ))}
      </span>
    </span>
  );
}

export function Library() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  /** Time-limited playback URLs for the active playlist, by chapter index. */
  const [activeUrls, setActiveUrls] = useState<string[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase!
        .from('playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlaylists(data || []);
    } catch (err) {
      console.error('Error fetching playlists:', err);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const storagePaths = (playlist: Playlist) =>
    playlist.chapters.map((_, i) => chapterPath(playlist.user_id, playlist.id, i, playlist.format));

  const deletePlaylist = async (playlist: Playlist) => {
    if (!window.confirm('Are you sure you want to delete this audiobook?')) return;

    try {
      // Files first: if this fails we keep the row, so the user can retry
      // instead of being left with files nothing points to.
      const { error: storageError } = await supabase!.storage.from(AUDIO_BUCKET).remove(storagePaths(playlist));
      if (storageError) throw storageError;

      const { error: dbError } = await supabase!.from('playlists').delete().eq('id', playlist.id);
      if (dbError) throw dbError;

      setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
      if (activePlaylist?.id === playlist.id) {
        setActivePlaylist(null);
        setActiveUrls([]);
      }
    } catch (err) {
      console.error('Error deleting playlist:', err);
      alert(`Failed to delete: ${errorMessage(err)}`);
    }
  };

  const playPlaylist = async (playlist: Playlist) => {
    // Signed URLs work whether the bucket is public or private.
    const { data, error: urlError } = await supabase!.storage
      .from(AUDIO_BUCKET)
      .createSignedUrls(storagePaths(playlist), SIGNED_URL_TTL_SECONDS);
    if (urlError || !data) {
      setError(`Could not load audio: ${urlError ? errorMessage(urlError) : 'no data'}`);
      return;
    }
    setError(null);
    setActiveUrls(data.map(entry => entry.signedUrl ?? ''));
    setActivePlaylist(playlist);
    setCurrentChapterIndex(0);
  };

  const activePeaks = useMemo(
    () => (activePlaylist ? seededPeaks(`${activePlaylist.id}:${currentChapterIndex}`, 140) : []),
    [activePlaylist, currentChapterIndex],
  );

  const count = playlists.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl font-semibold sm:text-4xl">My Library</h1>
        <p className="mt-3 text-lg text-mist-muted">
          {loading ? 'Loading your audiobooks…' : count === 0 ? 'Audiobooks you save will appear here.' : `${count} audiobook${count === 1 ? '' : 's'}, ready when you are.`}
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            className="mb-6 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3.5 text-sm text-danger"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-ink-900/80" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : count === 0 && !error ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/[0.12] bg-ink-900/60 px-6 py-20 text-center">
          <span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-ink-800 text-signal">
            <Headphones className="h-7 w-7" />
          </span>
          <h2 className="text-2xl font-semibold">Your library is empty</h2>
          <p className="mt-2 max-w-sm text-mist-muted">Turn a PDF into audio, then choose Save to Library to keep it here.</p>
          <Link to="/" className="press mt-6 inline-flex h-12 items-center rounded-xl bg-signal px-6 font-semibold text-ink-950 shadow-signal hover:bg-signal-strong">
            Create an audiobook
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-6">
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {playlists.map((playlist, i) => {
                const active = activePlaylist?.id === playlist.id;
                const title = playlistTitle(playlist);
                const chapters = playlist.chapters.length;
                return (
                  <motion.li
                    key={playlist.id}
                    layout
                    initial={{ opacity: 0, transform: 'translateY(8px)' }}
                    animate={{ opacity: 1, transform: 'translateY(0px)' }}
                    exit={{ opacity: 0, transform: 'scale(0.97)' }}
                    transition={{ ...spring.smooth, delay: Math.min(i, 8) * 0.04 }}
                    className={`group relative flex items-center gap-4 rounded-2xl border p-3.5 pr-3 transition-colors duration-200 ${
                      active ? 'border-signal/40 bg-signal/[0.06]' : 'border-white/[0.06] bg-ink-900/80 hover:border-white/[0.12]'
                    }`}
                  >
                    <Cover seed={playlist.id} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-[17px] font-semibold" title={title}>{title}</h3>
                      <p className="mt-0.5 text-sm text-mist-muted">
                        {chapters} chapter{chapters === 1 ? '' : 's'}, {playlist.format.toUpperCase()}
                        <span className="text-mist-faint"> &nbsp;{new Date(playlist.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePlaylist(playlist)}
                      className="press grid h-9 w-9 place-items-center rounded-full text-mist-faint hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                      title="Delete"
                      aria-label="Delete audiobook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => playPlaylist(playlist)}
                      className={`press grid h-11 w-11 place-items-center rounded-full ${active ? 'bg-ink-700 text-signal' : 'bg-signal text-ink-950 shadow-signal hover:bg-signal-strong'}`}
                      aria-label={active ? `Now playing ${title}` : `Play ${title}`}
                    >
                      {active ? <AudioLines className="h-5 w-5" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait" initial={false}>
              {activePlaylist ? (
                <motion.div
                  key={activePlaylist.id}
                  initial={{ opacity: 0, transform: 'translateY(8px)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  exit={{ opacity: 0 }}
                  transition={spring.smooth}
                  className="rounded-3xl border border-white/[0.08] bg-ink-900/90 p-5 shadow-lift sm:p-6"
                >
                  <div className="mb-5 flex items-center gap-4">
                    <Cover seed={activePlaylist.id} size={56} />
                    <div className="min-w-0">
                      <p className="text-sm text-mist-muted">Now playing</p>
                      <h2 className="truncate text-xl font-semibold" title={playlistTitle(activePlaylist)}>{playlistTitle(activePlaylist)}</h2>
                    </div>
                  </div>

                  <AudioPlayer
                    src={activeUrls[currentChapterIndex] || undefined}
                    peaks={activePeaks}
                    autoPlay
                    onEnded={() => {
                      if (currentChapterIndex < activePlaylist.chapters.length - 1) setCurrentChapterIndex((i) => i + 1);
                    }}
                  />

                  {activePlaylist.chapters.length > 1 && (
                    <ol aria-label="Chapters" className="mt-5 max-h-64 space-y-0.5 overflow-y-auto border-t border-white/[0.06] pt-3">
                      {activePlaylist.chapters.map((chapter, idx) => {
                        const current = idx === currentChapterIndex;
                        return (
                          <li key={idx}>
                            <button
                              type="button"
                              onClick={() => setCurrentChapterIndex(idx)}
                              aria-current={current ? 'true' : undefined}
                              className={`press relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${current ? 'text-mist' : 'text-mist-muted hover:text-mist'}`}
                            >
                              {current && <motion.span layoutId="library-chapter-pill" transition={spring.tactile} className="absolute inset-0 rounded-xl bg-white/[0.06]" />}
                              <span className={`relative w-5 shrink-0 text-right font-mono text-xs tabular-nums ${current ? 'text-signal' : 'text-mist-faint'}`}>{idx + 1}</span>
                              <span className="relative truncate">{chapter.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                  className="hidden rounded-3xl border border-dashed border-white/[0.1] p-8 text-center lg:block"
                >
                  <p className="font-display text-lg font-semibold">Nothing playing</p>
                  <p className="mt-1 text-sm text-mist-muted">Press play on an audiobook to listen here.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
