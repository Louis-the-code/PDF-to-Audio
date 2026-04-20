import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Trash2, Play, Calendar, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomAudioPlayer } from './ui/CustomAudioPlayer';

interface Chapter {
  title: string;
  url: string;
  order: number;
}

interface Playlist {
  id: string;
  user_id: string;
  created_at: string;
  format: string;
  chapters: Chapter[];
}

export function Library() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
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
    } catch (err: any) {
      console.error('Error fetching playlists:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deletePlaylist = async (playlist: Playlist) => {
    if (!window.confirm('Are you sure you want to delete this audiobook?')) return;

    try {
      // 1. Delete files from storage
      const filePaths = playlist.chapters.map(
        (_, i) => `${playlist.user_id}/${playlist.id}/chapter_${i}.${playlist.format}`
      );
      
      const { error: storageError } = await supabase!.storage
        .from('audio-playlists')
        .remove(filePaths);

      if (storageError) console.error('Storage deletion error:', storageError);

      // 2. Delete database record
      const { error: dbError } = await supabase!
        .from('playlists')
        .delete()
        .eq('id', playlist.id);

      if (dbError) throw dbError;

      // 3. Update UI
      setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
      if (activePlaylist?.id === playlist.id) {
        setActivePlaylist(null);
      }
    } catch (err: any) {
      console.error('Error deleting playlist:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const playPlaylist = (playlist: Playlist) => {
    setActivePlaylist(playlist);
    setCurrentChapterIndex(0);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { stiffness: 300, damping: 30 } }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-10">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <h1 className="text-4xl font-bold tracking-tight mb-2">My Library</h1>
        <p className="text-white/50 text-lg">Manage and listen to your saved audiobooks.</p>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 mb-8"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {playlists.length === 0 && !error ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-32 bg-white/5 border border-white/10 rounded-[2rem] shadow-inner"
        >
          <div className="w-20 h-20 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6">
            <ListMusic className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-2xl font-semibold text-white/90 mb-3">Your library is empty</h3>
          <p className="text-white/50 max-w-md mx-auto">Generate and save some audiobooks from the Create tab to see them here.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Playlist Grid */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            <AnimatePresence>
              {playlists.map((playlist) => (
                <motion.div
                  layout
                  variants={itemVariants}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={playlist.id}
                  className={`group relative p-6 rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                    activePlaylist?.id === playlist.id 
                      ? 'border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.1)]' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1'
                  }`}
                >
                  {activePlaylist?.id === playlist.id && (
                    <motion.div 
                      layoutId="active-playlist-bg"
                      className="absolute inset-0 bg-white/10 z-0"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                  <div className="relative z-10 flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-300">
                        <ListMusic className="w-6 h-6 text-white/70" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-lg truncate max-w-[160px]" title={playlist.chapters[0]?.title || "Audiobook"}>
                          {playlist.chapters.length > 0 ? playlist.chapters[0].title : "Audiobook"}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(playlist.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deletePlaylist(playlist)}
                      className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="relative z-10 flex items-center justify-between mt-8">
                    <span className="text-xs font-medium text-white/50 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                      {playlist.chapters.length} Chapter{playlist.chapters.length !== 1 ? 's' : ''} • {playlist.format.toUpperCase()}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => playPlaylist(playlist)}
                      className="flex items-center gap-2 px-5 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-white/90 transition-colors shadow-lg shadow-white/10"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Play
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Active Player */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1 sticky top-24"
          >
            <AnimatePresence mode="wait">
              {activePlaylist ? (
                <motion.div 
                  key="active-player"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col gap-6 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <h3 className="text-white font-semibold text-xl">Now Playing</h3>
                    <motion.span 
                      key={currentChapterIndex}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-medium text-white/50 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5"
                    >
                      {currentChapterIndex + 1} of {activePlaylist.chapters.length}
                    </motion.span>
                  </div>
                  
                  <div className="relative group z-10">
                    <select
                      value={currentChapterIndex}
                      onChange={(e) => setCurrentChapterIndex(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pl-5 pr-12 text-sm text-white outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer group-hover:bg-black/60 transition-colors"
                    >
                      {activePlaylist.chapters.map((chapter, idx) => (
                        <option key={idx} value={idx} className="bg-zinc-900 text-white">
                          {idx + 1}. {chapter.title}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/70 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>

                  <div className="pt-2 relative z-10">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentChapterIndex}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CustomAudioPlayer 
                          src={activePlaylist.chapters[currentChapterIndex]?.url} 
                          autoPlay
                          onEnded={() => {
                            if (currentChapterIndex < activePlaylist.chapters.length - 1) {
                              setCurrentChapterIndex(prev => prev + 1);
                            }
                          }}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty-player"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-10 rounded-[2rem] bg-white/5 border border-white/10 border-dashed flex flex-col items-center justify-center text-center h-[400px]"
                >
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Play className="w-6 h-6 text-white/20 ml-1" />
                  </div>
                  <h3 className="text-lg font-medium text-white/80 mb-2">Ready to Play</h3>
                  <p className="text-white/40 text-sm max-w-[200px]">Select an audiobook from your library to start listening</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </div>
  );
}
