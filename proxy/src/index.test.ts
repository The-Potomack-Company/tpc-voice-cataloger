import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, getCorsHeaders } from './index';

const ALLOWED = 'https://tpc-cataloging-app.vercel.app,https://localhost:5173';

describe('isAllowedOrigin', () => {
  it('allows exact match from ALLOWED_ORIGINS', () => {
    expect(isAllowedOrigin('https://tpc-cataloging-app.vercel.app', ALLOWED)).toBe(true);
  });

  it('allows localhost for local dev', () => {
    expect(isAllowedOrigin('https://localhost:5173', ALLOWED)).toBe(true);
  });

  it('allows *.vercel.app preview deploys', () => {
    expect(isAllowedOrigin('https://my-branch-tpc-cataloging-app.vercel.app', ALLOWED)).toBe(true);
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
