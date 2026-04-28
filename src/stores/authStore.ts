import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { trackEvent, trackEventNow } from '../services/analytics';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

// Re-entry guard: prevents duplicate auth.logout rows when the sign-out button
// is double-clicked or a navigation triggers a second concurrent signOut.
let signingOut = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  loading: true,

  initialize: () => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });
    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      trackEvent({ event_type: 'auth.login' });
    } else {
      trackEvent({ event_type: 'auth.login.failed', error_message: error.message, error_count: 1 });
    }
    return { error };
  },

  signOut: async () => {
    if (signingOut) return;
    signingOut = true;
    try {
      // Capture email from the in-memory store snapshot (synchronous) so it survives
      // even if supabase.auth.getUser() races with the impending signOut.
      const email = get().user?.email ?? null;
      // Direct insert (awaited) so the row lands while the session is still valid.
      await trackEventNow({ event_type: 'auth.logout', user_email: email });
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      signingOut = false;
    }
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  },
}));
