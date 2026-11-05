import React, { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PasswordInput } from './ui/PasswordInput';

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
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-md bg-white/5 border border-white/10 p-8 sm:p-10 rounded-[2rem] space-y-5">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Set a new password</h1>
          <p className="text-white/60 text-sm">Choose a new password for your account.</p>
        </div>

        {error && (
          <div role="alert" className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {[
          { id: 'new-password', label: 'New password', value: password, set: setPassword },
          { id: 'confirm-password', label: 'Confirm new password', value: confirm, set: setConfirm },
        ].map((field) => (
          <div key={field.id} className="space-y-1.5">
            <label htmlFor={field.id} className="text-xs font-medium text-white/70 ml-1">
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
          className="w-full bg-white text-black font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-50 mt-8"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save password <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
    </div>
  );
}
