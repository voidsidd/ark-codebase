import { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        if (mode === 'signup') {
          if (!displayName.trim()) {
            setError('Display name is required');
            setLoading(false);
            return;
          }
          await signUp(email, password, displayName);
          setSignupSuccess(true);
        } else {
          await signIn(email, password);
          // Auth state change will redirect via App.tsx
        }
      } catch (err: any) {
        setError(err?.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, displayName, signIn, signUp]
  );

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-vanguard-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border border-vanguard-species/40 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-syne text-2xl font-bold text-white mb-3 tracking-wider">
            CHECK YOUR EMAIL
          </h2>
          <p className="font-mono text-sm text-white/50 leading-relaxed mb-8">
            We've sent a confirmation link to <span className="text-vanguard-species">{email}</span>
            . Click it to activate your account, then return here to sign in.
          </p>
          <button
            onClick={() => {
              setMode('login');
              setSignupSuccess(false);
            }}
            className="font-mono text-xs text-vanguard-species/70 hover:text-vanguard-species transition-colors tracking-widest"
          >
            ← BACK TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vanguard-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle grid lines */}
      <div className="absolute inset-0 bg-topo opacity-30 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-vanguard-species animate-pulse" />
            <span className="font-syne text-xs font-bold tracking-[0.35em] text-white/40 uppercase">
              Vanguard
            </span>
            <div className="w-2 h-2 rounded-full bg-vanguard-species animate-pulse" />
          </div>
          <h1 className="font-syne text-3xl font-bold text-white tracking-wider">
            {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </h1>
          <p className="font-mono text-xs text-white/30 mt-2 tracking-wide">
            {mode === 'login' ? 'Wildlife Intelligence Platform' : 'Private estate monitoring'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div>
              <label className="block font-mono text-[10px] text-white/40 tracking-widest mb-2 uppercase">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ranger Callsign"
                className="w-full bg-vanguard-panel border border-vanguard-border rounded px-4 py-3 font-mono text-sm text-white placeholder:text-white/20 focus:border-vanguard-species/50 focus:outline-none transition-colors"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="block font-mono text-[10px] text-white/40 tracking-widest mb-2 uppercase">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operative@vanguard.io"
              className="w-full bg-vanguard-panel border border-vanguard-border rounded px-4 py-3 font-mono text-sm text-white placeholder:text-white/20 focus:border-vanguard-species/50 focus:outline-none transition-colors"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] text-white/40 tracking-widest mb-2 uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-vanguard-panel border border-vanguard-border rounded px-4 py-3 font-mono text-sm text-white placeholder:text-white/20 focus:border-vanguard-species/50 focus:outline-none transition-colors"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-vanguard-critical/10 border border-vanguard-critical/30 rounded">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="font-mono text-xs text-vanguard-critical">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-vanguard-species/90 hover:bg-vanguard-species text-vanguard-bg font-syne font-bold text-sm tracking-widest rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'AUTHENTICATING...' : mode === 'login' ? 'ACCESS SYSTEM' : 'CREATE ACCOUNT'}
          </button>
        </form>

        {/* Mode toggle */}
        <div className="text-center mt-8">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
            className="font-mono text-xs text-white/30 hover:text-vanguard-species/70 transition-colors tracking-wide"
          >
            {mode === 'login'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="font-mono text-[10px] text-white/15 tracking-widest">
            GOVERNMENT ACCESS IS INVITE-ONLY
          </p>
        </div>
      </div>
    </div>
  );
}
