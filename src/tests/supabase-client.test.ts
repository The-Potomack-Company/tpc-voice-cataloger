import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@supabase/supabase-js');
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

  it('rewrites Supabase REST URLs to bare PostgREST URLs with query strings', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('[]'));
    const { createFirebasePostgrestFetch } = await import('../lib/supabase');
    const wrappedFetch = createFirebasePostgrestFetch(
      'https://postgrest.example.com',
      fetchImpl as unknown as typeof fetch,
    );

    await wrappedFetch(
      'https://postgrest.example.com/rest/v1/profiles?select=id%2Cemail&order=created_at.asc',
      { method: 'GET' },
    );

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://postgrest.example.com/profiles?select=id%2Cemail&order=created_at.asc',
    );
    expect(init).toEqual({ method: 'GET' });
  });

  it('throws loudly if Firebase mode attempts Supabase Auth or Storage calls', async () => {
    const fetchImpl = vi.fn();
    const { createFirebasePostgrestFetch } = await import('../lib/supabase');
    const wrappedFetch = createFirebasePostgrestFetch(
      'https://postgrest.example.com',
      fetchImpl as unknown as typeof fetch,
    );

    expect(() => wrappedFetch('https://postgrest.example.com/auth/v1/user')).toThrow(
      'Firebase mode must not call Supabase Auth through PostgREST',
    );
    expect(() => wrappedFetch('https://postgrest.example.com/storage/v1/object/audio')).toThrow(
      'Firebase mode must not call Supabase Storage through PostgREST',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('injects the Firebase PostgREST fetch into supabase-js', async () => {
    vi.stubEnv('VITE_AUTH_BACKEND', 'firebase');
    vi.stubEnv('VITE_POSTGREST_URL', 'https://postgrest.example.com');
    vi.stubEnv('VITE_POSTGREST_ANON_KEY', '');
    vi.doMock('../lib/firebaseAuth', () => ({
      getFreshFirebaseIdToken: vi.fn().mockResolvedValue('firebase-token'),
    }));
    const createClient = vi.fn(() => ({ from: vi.fn() }));
    vi.doMock('@supabase/supabase-js', () => ({ createClient }));

    const mod = await import('../lib/supabase');
    expect(typeof mod.supabase.from).toBe('function');

    expect(createClient).toHaveBeenCalledWith(
      'https://postgrest.example.com',
      'postgrest-anon',
      expect.objectContaining({
        accessToken: expect.any(Function),
        global: {
          fetch: expect.any(Function),
        },
      }),
    );
  });
});
