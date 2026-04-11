/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WavyPDF } from "./components/WavyPDF";
import { Auth } from "./components/Auth";
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Loader2, LogOut, Library } from 'lucide-react';

function Layout({ children, session }: { children: React.ReactNode, session: Session }) {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/30 flex flex-col">
      <header className="w-full border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
            <span className="font-bold tracking-tight">WavyPDF</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/50 hidden sm:inline-block">{session.user.email}</span>
            <button 
              onClick={() => supabase?.auth.signOut()}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
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
      <Routes>
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
          path="/auth" 
          element={!session ? <Auth /> : <Navigate to="/" replace />} 
        />
      </Routes>
    </Router>
  );
}
