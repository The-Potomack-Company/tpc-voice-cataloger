import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';
import { isFirebaseAuthBackend } from './authBackend';
import { getFreshFirebaseIdToken } from './firebaseAuth';

let _client: SupabaseClient<Database> | null = null;

type FetchLike = typeof fetch;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, '');
}

function rewriteFirebasePostgrestUrl(inputUrl: string, postgrestUrl: string) {
  const requestUrl = new URL(inputUrl);
  const baseUrl = new URL(`${normalizeBaseUrl(postgrestUrl)}/`);
  const basePath = baseUrl.pathname.replace(/\/$/, '');
  const requestPath = requestUrl.pathname;

  if (requestUrl.origin !== baseUrl.origin || !requestPath.startsWith(`${basePath}/`)) {
    return inputUrl;
  }

  const relativePath = requestPath.slice(basePath.length);
  if (relativePath === '/auth/v1' || relativePath.startsWith('/auth/v1/')) {
    throw new Error('Firebase mode must not call Supabase Auth through PostgREST');
  }
  if (relativePath === '/storage/v1' || relativePath.startsWith('/storage/v1/')) {
    throw new Error('Firebase mode must not call Supabase Storage through PostgREST');
  }
  if (relativePath === '/rest/v1' || relativePath.startsWith('/rest/v1/')) {
    requestUrl.pathname = `${basePath}${relativePath.slice('/rest/v1'.length) || '/'}`;
    return requestUrl.toString();
  }

  return inputUrl;
}

export function createFirebasePostgrestFetch(postgrestUrl: string, fetchImpl: FetchLike = fetch): FetchLike {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return fetchImpl(new Request(rewriteFirebasePostgrestUrl(input.url, postgrestUrl), input), init);
    }
    return fetchImpl(rewriteFirebasePostgrestUrl(String(input), postgrestUrl), init);
  }) as FetchLike;
}

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
        ? {
          accessToken: getFreshFirebaseIdToken,
          global: {
            fetch: createFirebasePostgrestFetch(supabaseUrl),
          },
        }
        : undefined);
    }
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
