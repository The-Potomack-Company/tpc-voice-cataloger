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

// Re-entry guards: prevent duplicate auth.login / auth.logout rows when buttons
// are double-clicked or a navigation triggers a second concurrent call.
let signingIn = false;
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
    if (signingIn) return { error: null };
    signingIn = true;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        // Pass email synchronously — supabase.auth.getUser() may not yet reflect the
        // freshly signed-in user when trackEvent runs.
        trackEvent({ event_type: 'auth.login', user_email: email });
      } else {
        trackEvent({
          event_type: 'auth.login.failed',
          user_email: email,
          error_message: error.message,
          error_count: 1,
        });
      }
      return { error };
    } finally {
      signingIn = false;
    }
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
