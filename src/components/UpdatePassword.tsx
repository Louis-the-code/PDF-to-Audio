import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PasswordInput } from './ui/PasswordInput';
import { LogoMark } from './ui/Logo';

const MIN_PASSWORD_LENGTH = 8;

/** Shown after the user follows a password-reset email link. */
export function UpdatePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-[420px] space-y-5 rounded-3xl border border-white/[0.08] bg-ink-900/90 p-7 shadow-lift sm:p-9">
        <div className="mb-8">
          <span className="mb-6 flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight">WavyPDF</span>
          </span>
          <h1 className="text-3xl font-semibold">Set a new password</h1>
          <p className="mt-2 text-mist-muted">Choose a new password for your account.</p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {[
          { id: 'new-password', label: 'New password', value: password, set: setPassword },
          { id: 'confirm-password', label: 'Confirm new password', value: confirm, set: setConfirm },
        ].map((field) => (
          <div key={field.id} className="space-y-2">
            <label htmlFor={field.id} className="text-sm font-medium text-mist-muted">
              {field.label}
            </label>
            <PasswordInput
              id={field.id}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="press mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-signal font-semibold text-ink-950 shadow-signal hover:bg-signal-strong disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save password'}
        </button>
      </form>
    </div>
  );
}
