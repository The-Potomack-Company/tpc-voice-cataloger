# tpc-ai-proxy Dual JWT Spec

The sibling `tpc-ai-proxy` repository is outside this worktree's writable root, so Phase 1 records the exact change here for a separate dispatch.

## Goal

During cutover, accept either existing Supabase JWTs or new Firebase ID tokens in the `Authorization: Bearer <token>` header. Fail closed if neither verifier accepts the token.

## Config

Add required Firebase verifier config:

- `FIREBASE_PROJECT_ID=gen-lang-client-0662587427`

Keep existing Supabase config during the cutover window:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## `src/auth.js`

Keep the existing Supabase round-trip verifier. Add a Firebase verifier that validates Google Secure Token JWTs against project `gen-lang-client-0662587427`, verifies issuer/audience, and requires email domain `potomackco.com`.

Implementation sketch:

```js
export async function verifyAuth(authHeader, config) {
  const token = extractBearer(authHeader);
  if (!token) return false;
  return (
    await verifySupabaseToken(token, config) ||
    await verifyFirebaseToken(token, config)
  );
}
```

`verifyFirebaseToken` should use a standard JWT verifier/JWKS cache rather than calling Firebase per request. Expected checks:

- `iss === "https://securetoken.google.com/gen-lang-client-0662587427"`
- `aud === "gen-lang-client-0662587427"`
- `exp`, `iat`, and signature are valid
- `email` ends with `@potomackco.com`
- `email_verified === true`
- Firebase sign-in provider is Google

Do not require `hd` in Phase 1 Firebase ID tokens. Google's raw hosted-domain value is only available to the client at popup sign-in via `getAdditionalUserInfo(result).profile.hd`. Phase 2 should add defense-in-depth by having `cataloger-api` provision a server-side `hd` custom claim with the Firebase Admin SDK after Workspace membership is verified.

## Tests

Extend `test/auth.test.js`:

- Supabase 200 still returns `true`.
- Supabase non-200 plus valid Firebase JWT returns `true`.
- Supabase non-200 plus Firebase wrong audience returns `false`.
- Supabase non-200 plus Firebase wrong email domain returns `false`.
- Missing/non-Bearer still returns `false` without network calls.
