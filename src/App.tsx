/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Loader2, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { Backdrop } from './components/ui/Backdrop';
import { Logo } from './components/ui/Logo';
import { spring } from './lib/motion';

// Pages are split into their own chunks: react-pdf and pdf.js are heavy and the
// sign-in screen needs none of the conversion code.
const WavyPDF = lazy(() => import('./components/WavyPDF').then(m => ({ default: m.WavyPDF })));
const Library = lazy(() => import('./components/Library').then(m => ({ default: m.Library })));
const Auth = lazy(() => import('./components/Auth').then(m => ({ default: m.Auth })));
const UpdatePassword = lazy(() => import('./components/UpdatePassword').then(m => ({ default: m.UpdatePassword })));

function Spinner() {
  return (
    <div className="relative z-10 min-h-[50vh] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-mist-faint animate-spin" />
    </div>
  );
}

const NAV = [
  { to: '/', label: 'Create' },
  { to: '/library', label: 'Library' },
];

function NavLinks() {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Main" className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-ink-900/80 p-1">
      {NAV.map(({ to, label }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`press relative rounded-full px-4 py-1.5 text-sm font-medium ${active ? 'text-mist' : 'text-mist-muted hover:text-mist'}`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-ink-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                transition={spring.tactile}
              />
            )}
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Layout({ session }: { session: Session }) {
  const location = useLocation();
  const email = session.user.email ?? '';

  return (
    <div className="relative min-h-screen flex flex-col text-mist">
      <header className="glass sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
          <Link to="/" className="press justify-self-start rounded-lg" aria-label="WavyPDF home">
            <Logo compact />
          </Link>

          <NavLinks />

          <div className="flex items-center gap-2 justify-self-end">
            <span
              className="hidden md:grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-semibold uppercase text-mist"
              title={email}
              aria-hidden
            >
              {email.slice(0, 1)}
            </span>
            <button
              type="button"
              onClick={() => supabase?.auth.signOut()}
              className="press grid h-9 w-9 place-items-center rounded-full text-mist-muted hover:bg-white/[0.06] hover:text-mist"
              title={`Sign out ${email}`}
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="relative z-10 flex-1">
        {/* Only the page content is keyed, so the header stays put between pages. */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, transform: 'translateY(6px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </main>
    </div>
  );
}

function AppRoutes({ session }: { session: Session | null }) {
  return (
    <Routes>
      <Route element={session ? <Layout session={session} /> : <Navigate to="/auth" replace />}>
        <Route path="/" element={<WavyPDF />} />
        <Route path="/library" element={<Library />} />
      </Route>
      <Route
        path="/auth"
        element={
          session ? (
            <Navigate to="/" replace />
          ) : (
            <Suspense fallback={<Spinner />}>
              <Auth />
            </Suspense>
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  /** True after the user arrives from a password-reset email link. */
  // Read the link marker on first render too: the auth client can process the link
  // before our listener below is attached, and the event would then be missed.
  const [recovering, setRecovering] = useState(() => /type=recovery/.test(window.location.hash));

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Backdrop />
      {loading ? (
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-mist-faint animate-spin" />
        </div>
      ) : recovering ? (
        <Suspense fallback={<Spinner />}>
          <UpdatePassword onDone={() => setRecovering(false)} />
        </Suspense>
      ) : (
        <Router>
          <AppRoutes session={session} />
        </Router>
      )}
    </>
  );
}
