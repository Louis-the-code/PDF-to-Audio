import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import ShaderBackground from './ui/ShaderBackground';

type Mode = 'login' | 'signup' | 'reset';

const MIN_PASSWORD_LENGTH = 8;

export function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const isLogin = mode === 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        // Send confirmation links back to whichever deployment the user signed up on.
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      } else {
        // The link signs the user in for recovery; App then shows the set-new-password screen.
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage('If an account exists for that email, a password reset link is on its way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.1 
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { stiffness: 300, damping: 30 } }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans selection:bg-white/30 relative overflow-hidden">
      {/* Animated Background */}
      <ShaderBackground />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md bg-white/5 border border-white/10 p-8 sm:p-10 rounded-[2rem] backdrop-blur-2xl relative z-10 shadow-2xl shadow-black/50"
      >
        <motion.div variants={itemVariants} className="text-center mb-10">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
            <div className="w-6 h-6 bg-white rounded-full" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">WavyPDF</h1>
          <p className="text-white/60 text-sm">
            {mode === 'login'
              ? 'Welcome back to your audiobook library.'
              : mode === 'signup'
                ? 'Create an account to save your audiobooks to the cloud.'
                : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </motion.div>

        <form onSubmit={handleAuth} className="space-y-5">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm overflow-hidden"
              >
                {error}
              </motion.div>
            )}
            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm overflow-hidden"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="space-y-1.5">
            <label htmlFor="auth-email" className="text-xs font-medium text-white/70 ml-1">Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-white/80 transition-colors" />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/5 transition-all"
                placeholder="you@example.com"
              />
            </div>
          </motion.div>

          {mode !== 'reset' && (
          <motion.div variants={itemVariants} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="auth-password" className="text-xs font-medium text-white/70 ml-1">Password</label>
              {isLogin && (
                <button type="button" onClick={() => switchMode('reset')} className="text-xs text-white/50 hover:text-white transition-colors">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-white/80 transition-colors" />
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/5 transition-all"
                placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD_LENGTH} characters` : "••••••••"}
              />
            </div>
          </motion.div>
          )}

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-50 mt-8 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </motion.button>
        </form>

        <motion.div variants={itemVariants} className="mt-8 text-center">
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'signup' : 'login')}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : mode === 'signup' ? 'Already have an account? Sign in' : 'Back to sign in'}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
