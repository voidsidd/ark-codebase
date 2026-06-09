import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  display_name: string;
  role: 'super_admin' | 'government' | 'private';
  department: string | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
}

// ── How long to wait for getSession() before force-resolving as unauthenticated
const SESSION_TIMEOUT_MS = 6_000;

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
  });

  // Guard: ensure loading never stays true forever
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedRef = useRef(false);

  // Fetch profile from profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      return data as Profile | null;
    } catch {
      return null;
    }
  }, []);

  const applySession = useCallback(
    async (session: Session | null) => {
      resolvedRef.current = true;
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({ user: session.user, profile, session, loading: false });
      } else {
        setState({ user: null, profile: null, session: null, loading: false });
      }
    },
    [fetchProfile]
  );

  // ── Core effect: init + subscribe ─────────────────────────────────────────
  useEffect(() => {
    resolvedRef.current = false;

    // Safety net: if getSession() hangs (cold start after idle), force-resolve
    // after SESSION_TIMEOUT_MS so the UI never gets permanently stuck
    loadingTimerRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        console.warn('[useAuth] getSession() timed out — forcing unauthenticated state');
        setState({ user: null, profile: null, session: null, loading: false });
        resolvedRef.current = true;
      }
    }, SESSION_TIMEOUT_MS);

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch(() => {
        applySession(null);
      });

    // Listen for auth state changes (covers token refresh, sign in/out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    // ── Visibility change: re-check session when tab becomes active again ──
    // This is the key fix for the "idle timeout → stuck on Authenticating" bug
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth
          .getSession()
          .then(({ data: { session } }) => {
            // Only update if the session state actually changed
            setState((prev) => {
              const prevId = prev.session?.access_token;
              const nextId = session?.access_token;
              if (prevId === nextId) return prev; // no change, no re-render
              return { ...prev, loading: false };
            });
            // Refresh token if session exists but might be stale
            if (session) {
              supabase.auth.refreshSession().catch(() => {});
            }
          })
          .catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [applySession]);

  // Sign up (private users only — government accounts are admin-assigned)
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
    return data;
  }, []);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!state.user,
    isSuperAdmin: state.profile?.role === 'super_admin',
    isGovernment: state.profile?.role === 'government',
    isPrivate: state.profile?.role === 'private',
  };
}
