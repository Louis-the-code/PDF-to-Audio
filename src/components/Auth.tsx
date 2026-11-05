import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchEnabledProviders, readAuthErrorFromUrl } from '../lib/authProviders';
import { Loader2, Mail, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PasswordInput } from './ui/PasswordInput';

import ShaderBackground from './ui/ShaderBackground';

type Mode = 'login' | 'signup' | 'reset';

interface Notice {
  kind: 'error' | 'success';
  text: string;
  /** Shortcuts shown under the message, e.g. "Sign in instead". */
  actions?: { label: string; mode: Mode }[];
}

const MIN_PASSWORD_LENGTH = 8;

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const isLogin = mode === 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(() => {
    const urlError = readAuthErrorFromUrl();
    return urlError ? { kind: 'error', text: urlError } : null;
  });
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEnabledProviders().then(({ google }) => !cancelled && setGoogleEnabled(google));
    return () => {
      cancelled = true;
    };
  }, []);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setNotice({ kind: 'error', text: 'The passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.code === 'invalid_credentials') {
            setNotice({
              kind: 'error',
              text: "That email and password don't match.",
              actions: [{ label: 'Reset your password', mode: 'reset' }],
            });
            return;
          }
          if (error.code === 'email_not_confirmed') {
            setNotice({ kind: 'error', text: 'Please confirm your email first: open the link we sent you, then sign in.' });
            return;
          }
          throw error;
        }
      } else if (mode === 'signup') {
        // Send confirmation links back to whichever deployment the user signed up on.
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        // Supabase answers a sign-up for an existing account with a user that has no
        // identities, and sends no email. Say so instead of promising an email.
        if (data.user && data.user.identities?.length === 0) {
          setNotice({
            kind: 'error',
            text: 'An account with this email already exists.',
            actions: [
              { label: 'Sign in', mode: 'login' },
              { label: 'Reset password', mode: 'reset' },
            ],
          });
          return;
        }
        // With email confirmation off, sign-up signs the user straight in.
        if (data.session) return;
        setNotice({ kind: 'success', text: `We sent a confirmation link to ${email}. Open it to finish creating your account (check spam too).` });
      } else {
        // The link signs the user in for recovery; App then shows the set-new-password screen.
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setNotice({ kind: 'success', text: 'If an account exists for that email, a password reset link is on its way (check spam too).' });
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setNotice(null);
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setNotice({ kind: 'error', text: error.message });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
    setConfirmPassword('');
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

        {googleEnabled && mode !== 'reset' && (
          <motion.div variants={itemVariants} className="mb-6">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-medium rounded-2xl py-3.5 flex items-center justify-center gap-3 transition-colors"
            >
              <GoogleLogo />
              Continue with Google
            </button>
            <div className="flex items-center gap-3 mt-6 text-xs text-white/40">
              <div className="h-px flex-1 bg-white/10" />
              or use your email
              <div className="h-px flex-1 bg-white/10" />
            </div>
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <AnimatePresence mode="wait">
            {notice && (
              <motion.div
                key={notice.text}
                role={notice.kind === 'error' ? 'alert' : 'status'}
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className={`p-4 rounded-2xl text-sm overflow-hidden border ${
                  notice.kind === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
                }`}
              >
                {notice.text}
                {notice.actions && (
                  <div className="flex gap-4 mt-2">
                    {notice.actions.map((action) => (
                      <button key={action.mode} type="button" onClick={() => switchMode(action.mode)} className="font-semibold underline underline-offset-2 hover:text-white">
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
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
              <PasswordInput
                id="auth-password"
                required
                minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD_LENGTH} characters` : '••••••••'}
              />
            </motion.div>
          )}

          {mode === 'signup' && (
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="space-y-1.5">
              <label htmlFor="auth-password-confirm" className="text-xs font-medium text-white/70 ml-1">Confirm password</label>
              <PasswordInput
                id="auth-password-confirm"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Type it again"
              />
              {confirmPassword.length > 0 && (
                <p className={`text-xs ml-1 flex items-center gap-1 ${passwordsMatch ? 'text-green-400' : 'text-white/50'}`}>
                  {passwordsMatch ? <><Check className="w-3.5 h-3.5" /> Passwords match</> : 'Passwords do not match yet'}
                </p>
              )}
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
