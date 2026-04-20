/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { WavyPDF } from "./components/WavyPDF";
import { Auth } from "./components/Auth";
import { Library } from "./components/Library";
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Loader2, LogOut, Library as LibraryIcon, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import ShaderBackground from './components/ui/ShaderBackground';

function NavLinks() {
  const location = useLocation();
  
  return (
    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10 relative">
      <Link 
        to="/" 
        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors z-10 ${
          location.pathname === '/' ? 'text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
      >
        {location.pathname === '/' && (
          <motion.div 
            layoutId="nav-pill"
            className="absolute inset-0 bg-white rounded-full -z-10"
            transition={{ stiffness: 300, damping: 30 }}
          />
        )}
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">Create</span>
      </Link>
      <Link 
        to="/library" 
        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors z-10 ${
          location.pathname === '/library' ? 'text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
      >
        {location.pathname === '/library' && (
          <motion.div 
            layoutId="nav-pill"
            className="absolute inset-0 bg-white rounded-full -z-10"
            transition={{ stiffness: 300, damping: 30 }}
          />
        )}
        <LibraryIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Library</span>
      </Link>
    </div>
  );
}

function Layout({ children, session }: { children: React.ReactNode, session: Session }) {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/30 flex flex-col relative overflow-hidden">
      {/* Global Background Elements */}
      <ShaderBackground />

      <header className="w-full border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <span className="font-bold tracking-tight text-lg hidden sm:inline-block">WavyPDF</span>
          </div>
          
          <NavLinks />

          <div className="flex items-center gap-4">
            <span className="text-xs text-white/50 hidden md:inline-block bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              {session.user.email}
            </span>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => supabase?.auth.signOut()}
              className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-white/70 hover:text-red-400 border border-transparent hover:border-red-500/20"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function AnimatedRoutes({ session }: { session: Session | null }) {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/" 
          element={
            session ? (
              <Layout session={session}>
                <WavyPDF />
              </Layout>
            ) : (
              <Navigate to="/auth" replace />
            )
          } 
        />
        <Route 
          path="/library" 
          element={
            session ? (
              <Layout session={session}>
                <Library />
              </Layout>
            ) : (
              <Navigate to="/auth" replace />
            )
          } 
        />
        <Route 
          path="/auth" 
          element={
            !session ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Auth />
              </motion.div>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <AnimatedRoutes session={session} />
    </Router>
  );
}
