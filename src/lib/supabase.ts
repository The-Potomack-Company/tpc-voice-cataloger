import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'VITE_SUPABASE_URL is not set. Add it to .env.local'
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is not set. Add it to .env.local'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
