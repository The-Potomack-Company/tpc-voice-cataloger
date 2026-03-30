import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';

let _client: SupabaseClient<Database> | null = null;

export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    if (!_client) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not set. Add it to .env.local');
      }
      if (!supabaseAnonKey) {
        throw new Error('VITE_SUPABASE_ANON_KEY is not set. Add it to .env.local');
      }
      _client = createClient<Database>(supabaseUrl, supabaseAnonKey);
    }
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
