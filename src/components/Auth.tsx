import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchEnabledProviders, readAuthErrorFromUrl } from '../lib/authProviders';
import { Loader2, Mail, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PasswordInput } from './ui/PasswordInput';
import { LogoMark } from './ui/Logo';
import { Waveform } from './ui/Waveform';
import { seededPeaks } from '../lib/peaks';
import { fade } from '../lib/motion';

const HERO_PEAKS = seededPeaks('wavypdf', 120);

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

  const fieldLabel = 'text-sm font-medium text-mist-muted';
  const input =
    'h-12 w-full rounded-xl border border-white/[0.08] bg-ink-800 pl-11 pr-4 text-[15px] text-mist placeholder:text-mist-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-signal/60 focus:shadow-[0_0_0_4px_rgb(255_138_92/0.12)]';

  const heading = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const subheading =
    mode === 'login'
      ? 'Sign in to your audiobook library.'
      : mode === 'signup'
        ? 'Save your audiobooks and listen anywhere.'
        : "Enter your email and we'll send you a reset link.";

  return (
    <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side (desktop): the one expressive moment on this screen. */}
      <section className="hidden flex-col justify-between p-12 lg:flex">
        <span className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight">WavyPDF</span>
        </span>
        <div className="max-w-xl">
          <h1 className="font-display text-6xl font-semibold leading-[1.02] tracking-[-0.035em]">Turn any PDF into an audiobook.</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-mist-muted">
            Pick a voice, drop in a document, and listen while you walk, cook or commute.
          </p>
          <div className="mt-12 max-w-lg">
            <Waveform peaks={HERO_PEAKS} progress={0.38} breathing height={88} label="Decorative sound wave" />
          </div>
        </div>
        <p className="text-sm text-mist-faint">Your documents stay private to your account.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, transform: 'translateY(12px) scale(0.98)' }}
          animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          className="w-full max-w-[420px] rounded-3xl border border-white/[0.08] bg-ink-900/90 p-7 shadow-lift sm:p-9"
        >
          <div className="mb-8">
            <span className="mb-6 flex items-center gap-2.5 lg:hidden">
              <LogoMark />
              <span className="font-display text-lg font-semibold tracking-tight">WavyPDF</span>
            </span>
            <h2 className="text-3xl font-semibold">{heading}</h2>
            <p className="mt-2 text-mist-muted">{subheading}</p>
          </div>

          {googleEnabled && mode !== 'reset' && (
            <div className="mb-6">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="press flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-mist font-medium text-ink-950 hover:bg-white"
              >
                <GoogleLogo />
                Continue with Google
              </button>
              <div className="mt-6 flex items-center gap-3 text-xs text-mist-faint">
                <div className="h-px flex-1 bg-white/[0.08]" />
                or with email
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <AnimatePresence mode="wait" initial={false}>
              {notice && (
                <motion.div
                  key={notice.text}
                  role={notice.kind === 'error' ? 'alert' : 'status'}
                  initial={{ opacity: 0, transform: 'translateY(-4px)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                  className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                    notice.kind === 'error' ? 'border-danger/25 bg-danger/10 text-danger' : 'border-ok/25 bg-ok/10 text-ok'
                  }`}
                >
                  {notice.text}
                  {notice.actions && (
                    <div className="mt-2 flex gap-4">
                      {notice.actions.map((action) => (
                        <button key={action.mode} type="button" onClick={() => switchMode(action.mode)} className="font-semibold text-mist underline decoration-white/30 underline-offset-4 hover:decoration-white">
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label htmlFor="auth-email" className={fieldLabel}>Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-faint" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={input}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-password" className={fieldLabel}>Password</label>
                  {isLogin && (
                    <button type="button" onClick={() => switchMode('reset')} className="text-sm text-mist-muted hover:text-mist">
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
                  placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-2">
                <label htmlFor="auth-password-confirm" className={fieldLabel}>Confirm password</label>
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
                  <p className={`flex items-center gap-1.5 text-sm ${passwordsMatch ? 'text-ok' : 'text-mist-faint'}`}>
                    {passwordsMatch ? <><Check className="h-4 w-4" /> Passwords match</> : 'Passwords do not match yet'}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="press mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-signal font-semibold text-ink-950 shadow-signal hover:bg-signal-strong disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-7 text-center">
            <button
              type="button"
              onClick={() => switchMode(isLogin ? 'signup' : 'login')}
              className="text-sm text-mist-muted hover:text-mist"
            >
              {isLogin ? "Don't have an account? Sign up" : mode === 'signup' ? 'Already have an account? Sign in' : 'Back to sign in'}
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
