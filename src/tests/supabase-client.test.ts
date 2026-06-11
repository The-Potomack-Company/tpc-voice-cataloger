import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('../lib/firebaseAuth');
    vi.unstubAllEnvs();
  });

  it('throws if VITE_SUPABASE_URL is missing on first access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const mod = await import('../lib/supabase');
    expect(() => mod.supabase.auth).toThrow('VITE_SUPABASE_URL is not set');
  });

  it('throws if VITE_SUPABASE_ANON_KEY is missing on first access', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const mod = await import('../lib/supabase');
    expect(() => mod.supabase.auth).toThrow('VITE_SUPABASE_ANON_KEY is not set');
  });

  it('exports a supabase client when env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    const mod = await import('../lib/supabase');
    expect(mod.supabase).toBeDefined();
    expect(typeof mod.supabase.from).toBe('function');
    expect(typeof mod.supabase.auth).toBe('object');
  });

  it('uses PostgREST and Firebase access tokens in firebase backend mode', async () => {
    vi.stubEnv('VITE_AUTH_BACKEND', 'firebase');
    vi.stubEnv('VITE_POSTGREST_URL', 'https://postgrest.example.com');
    vi.stubEnv('VITE_POSTGREST_ANON_KEY', '');
    vi.doMock('../lib/firebaseAuth', () => ({
      getFreshFirebaseIdToken: vi.fn().mockResolvedValue('firebase-token'),
    }));

    const mod = await import('../lib/supabase');

    expect(mod.supabase).toBeDefined();
    expect(typeof mod.supabase.from).toBe('function');
  });
});
