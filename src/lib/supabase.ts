import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';
import { isFirebaseAuthBackend } from './authBackend';
import { getFreshFirebaseIdToken } from './firebaseAuth';

let _client: SupabaseClient<Database> | null = null;

export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    if (!_client) {
      const firebaseMode = isFirebaseAuthBackend();
      const supabaseUrl = firebaseMode
        ? import.meta.env.VITE_POSTGREST_URL
        : import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = firebaseMode
        ? (import.meta.env.VITE_POSTGREST_ANON_KEY || 'postgrest-anon')
        : import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl) {
        throw new Error(
          `${firebaseMode ? 'VITE_POSTGREST_URL' : 'VITE_SUPABASE_URL'} is not set. Add it to .env.local`,
        );
      }
      if (!supabaseAnonKey) {
        throw new Error(
          `${firebaseMode ? 'VITE_POSTGREST_ANON_KEY' : 'VITE_SUPABASE_ANON_KEY'} is not set. Add it to .env.local`,
        );
      }
      _client = createClient<Database>(supabaseUrl, supabaseAnonKey, firebaseMode
        ? { accessToken: getFreshFirebaseIdToken }
        : undefined);
    }
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
