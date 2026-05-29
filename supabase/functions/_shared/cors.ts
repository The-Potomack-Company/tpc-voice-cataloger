// Origin-pinned CORS for admin edge functions (SEC-6). Mirrors the proxy
// allowlist (proxy/src/index.ts): explicit ALLOWED_ORIGINS env entries plus
// our tpc-prefixed *.vercel.app preview deploys. Never reflect '*'.
export function isAllowedOrigin(origin: string, allowedOrigins: string): boolean {
  if (!origin) return false
  const allowed = allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.includes(origin)) return true
  if (origin.startsWith('https://') && origin.endsWith('.vercel.app')) {
    const hostPart = origin.slice('https://'.length)
    // Reject bare "vercel.app" and attacker-controlled *.vercel.app subdomains;
    // only our tpc-prefixed preview hosts pass.
    if (hostPart !== 'vercel.app' && hostPart.startsWith('tpc-')) return true
  }
  return false
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  // Deno.env.get throws without --allow-env (e.g. under `deno test`); fall back to
  // the tpc-prefix suffix rule so CORS still pins correctly when no list is granted.
  let allowedOrigins = ''
  try {
    allowedOrigins = Deno.env.get('ALLOWED_ORIGINS') || ''
  } catch {
    allowedOrigins = ''
  }
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (isAllowedOrigin(origin, allowedOrigins)) {
    return { ...base, 'Access-Control-Allow-Origin': origin }
  }
  // Disallowed/unknown origin: omit Access-Control-Allow-Origin so the browser blocks the response.
  return base
}
