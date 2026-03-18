import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Client', () => {
  beforeEach(() => {
    // Reset module cache so supabase.ts re-evaluates env vars
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('throws if VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    await expect(() => import('../lib/supabase')).rejects.toThrow('VITE_SUPABASE_URL is not set');
  });

  it('throws if VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await expect(() => import('../lib/supabase')).rejects.toThrow('VITE_SUPABASE_ANON_KEY is not set');
  });

  it('exports a supabase client when env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    const mod = await import('../lib/supabase');
    expect(mod.supabase).toBeDefined();
    expect(typeof mod.supabase.from).toBe('function');
    expect(typeof mod.supabase.auth).toBe('object');
  });
});
