import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    // Persist session in localStorage so it survives idle/tab-switch
    persistSession: true,
    // Auto-refresh token before it expires — prevents idle timeout
    autoRefreshToken: true,
    // Detect session from URL hash (needed for OAuth / magic links)
    detectSessionInUrl: true,
    // Use localStorage for session storage
    storage: window.localStorage,
  },
});
