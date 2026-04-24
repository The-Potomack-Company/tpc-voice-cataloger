import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../services/analytics';
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

export const useAuthStore = create<AuthState>()((set) => ({
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
    trackEvent({ event_type: 'auth.logout' });
    await supabase.auth.signOut({ scope: 'local' });
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  },
}));
