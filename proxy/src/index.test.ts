import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAllowedOrigin, getCorsHeaders, verifyAuth } from './index';

const ALLOWED = 'https://tpc-cataloging-app.vercel.app,https://localhost:5173';

describe('isAllowedOrigin', () => {
  it('allows exact match from ALLOWED_ORIGINS', () => {
    expect(isAllowedOrigin('https://tpc-cataloging-app.vercel.app', ALLOWED)).toBe(true);
  });

  it('allows localhost for local dev', () => {
    expect(isAllowedOrigin('https://localhost:5173', ALLOWED)).toBe(true);
  });

  it('allows tpc-prefixed *.vercel.app preview deploys', () => {
    expect(isAllowedOrigin('https://tpc-app-five-abc123.vercel.app', ALLOWED)).toBe(true);
  });

  it('rejects non-tpc *.vercel.app subdomains', () => {
    expect(isAllowedOrigin('https://evil-app.vercel.app', ALLOWED)).toBe(false);
  });

  it('rejects origins not in list and not *.vercel.app', () => {
    expect(isAllowedOrigin('https://evil.com', ALLOWED)).toBe(false);
  });

  it('rejects bare vercel.app (not a subdomain)', () => {
    expect(isAllowedOrigin('https://vercel.app', ALLOWED)).toBe(false);
  });

  it('rejects empty origin', () => {
    expect(isAllowedOrigin('', ALLOWED)).toBe(false);
  });
});

describe('getCorsHeaders', () => {
  const env = { GEMINI_API_KEY: 'test', ALLOWED_ORIGINS: ALLOWED };

  it('reflects allowed origin in ACAO header', () => {
    const req = new Request('https://proxy.example.com', {
      headers: { Origin: 'https://tpc-cataloging-app.vercel.app' },
    });
    const headers = getCorsHeaders(req, env);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://tpc-cataloging-app.vercel.app');
    expect(headers['Vary']).toBe('Origin');
  });

  it('returns empty object for disallowed origin', () => {
    const req = new Request('https://proxy.example.com', {
      headers: { Origin: 'https://evil.com' },
    });
    const headers = getCorsHeaders(req, env);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('verifyAuth', () => {
  const env = {
    GEMINI_API_KEY: 'test',
    ALLOWED_ORIGINS: ALLOWED,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-test-key',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when Supabase /auth/v1/user returns 200', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ status: 200 } as Response);
    const req = new Request('https://proxy.example.com', {
      headers: { Authorization: 'Bearer good' },
    });
    expect(await verifyAuth(req, env)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer good',
          apikey: 'anon-test-key',
        }),
      }),
    );
  });

  it('returns false when Supabase /auth/v1/user returns 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ status: 401 } as Response);
    const req = new Request('https://proxy.example.com', {
      headers: { Authorization: 'Bearer bad' },
    });
    expect(await verifyAuth(req, env)).toBe(false);
  });

  it('returns false and does not call fetch when Authorization header is missing', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const req = new Request('https://proxy.example.com');
    expect(await verifyAuth(req, env)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
