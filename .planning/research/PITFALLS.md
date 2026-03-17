# Pitfalls Research

**Domain:** Adding user accounts, auth, RBAC, and server-side session management to an existing offline-first PWA (v1.1 milestone)
**Researched:** 2026-03-17 (updated with concrete stack: Hono + Better Auth + Drizzle + Neon)
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Service Worker Caches Auth-Gated API Responses

**What goes wrong:**
The existing Workbox config caches static assets (`**/*.{js,css,html,ico,png,svg,woff2}`). When `/api/*` routes are added, Workbox may intercept these requests. Worse: if User A fetches sessions and User B logs in, Workbox serves User A's cached session list. Data integrity and security violation.

**Why it happens:**
v1.0 had no API calls. Workbox config was set-and-forget for static assets. New API routes are not automatically excluded.

**Prevention:**
1. Add `navigateFallbackDenylist: [/^\/api\/.*/]` to VitePWA workbox config.
2. Do NOT add runtime caching for `/api/` routes.
3. On logout, clear any runtime caches that may hold user-specific data.

**Detection:**
- Network tab shows "(from ServiceWorker)" on API calls
- User switches accounts but sees previous user's data
- API returns 200 when server is unreachable

---

### Pitfall 2: Client-Side Role Checks Without Server Enforcement

**What goes wrong:**
RBAC implemented only in React UI (specialist sees no "Export" button). A specialist opens DevTools, calls `fetch('/api/sessions/5/export', { credentials: 'include' })`, and gets the full JSON.

**Why it happens:**
In the v1.0 client-only app, hiding a button IS enforcement. When a server is added, enforcement must move server-side, but developers continue the "hide the button" pattern.

**Prevention:**
Enforce roles at THREE levels:
1. **Server (mandatory):** Hono middleware checks `session.user.role` from Better Auth. Specialist calling `/api/sessions/:id/export` gets 403.
2. **Route (defense in depth):** `<AdminGuard>` layout route wraps admin pages.
3. **UI (cosmetic):** Hide buttons for unauthorized roles.

Never treat level 3 as sufficient. Never skip level 1.

**Detection:**
- No middleware on API routes checking role
- Admin endpoints accessible via curl without auth
- Test suite only tests React UI, not API authorization

---

### Pitfall 3: Existing v1.0 IndexedDB Data Becomes Orphaned

**What goes wrong:**
v1.0 sessions, items, photos, and audio in IndexedDB have no `userId` field. When accounts are added, there is no way to assign ownership. Data becomes invisible in role-scoped views.

**Why it happens:**
The app was single-user. Ownership was implicit (one browser = one user).

**Prevention:**
Accept that v1.0 data is a separate era. Do NOT build a complex migration:
1. Before upgrading, admin exports important sessions using existing export feature.
2. v1.1 starts with clean server database.
3. Dexie data remains accessible for export but is not synced to server.
4. Optionally: add a "legacy sessions" section that shows un-migrated Dexie data.

**Why NOT data adoption flow:** Building a "claim existing data" feature adds complexity for a one-time use case with 2-5 users. Manual export + reimport is simpler and more reliable.

**Detection:**
- First login shows empty session list despite existing Dexie data
- Users confused about where their v1.0 sessions went

---

### Pitfall 4: The App Breaks Entirely When Server Is Down

**What goes wrong:**
Before v1.1, the app works with zero connectivity (except AI processing). After adding auth, the app requires server calls to log in and fetch sessions. If server is down or user is offline, the app shows a login screen that cannot complete.

**Why it happens:**
Auth flows are inherently server-dependent. Developers add fetch as a blocking prerequisite without considering failure modes.

**Prevention:**
Design auth with offline awareness:
1. **First login:** Requires network. Better Auth sets httpOnly session cookie.
2. **Subsequent launches offline:** Better Auth session cookie persists. If the cookie is valid, show cached data. Recording still works (saves to Dexie).
3. **Server unreachable:** Show "offline" indicator. Allow access to cached session data. Disable server-dependent actions (submit, assignment changes). Recording always works.
4. **Hard rule:** Recording and local data creation must NEVER be blocked by server unavailability.

**Detection:**
- Login is the only entry point with no offline fallback
- App shows blank screen when fetch to `/api/auth/session` times out
- Specialist at house visit cannot record because server is unreachable

---

### Pitfall 5: Vercel SPA Returns 404 on Direct Navigation

**What goes wrong:**
React Router routes like `/session/5` work via client navigation. But when user refreshes at `/session/5`, Vercel looks for `/session/5/index.html`. 404.

**Why it happens:**
Vercel serves static files by default. Without `vercel.json` rewrites, it does not know that all paths should serve `index.html`. Works perfectly in dev (Vite handles it).

**Prevention:**
Create `vercel.json` with ordered rewrites:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
API routes first, then SPA catch-all. Without the API exclusion, API calls get rewritten to `index.html`.

**Detection:**
- Routes work via navigation but 404 on refresh
- Only tested in `vite dev` or `vite preview`

---

### Pitfall 6: Session Lifecycle State Machine Has Implicit Transitions

**What goes wrong:**
Session status is a simple string field with ad-hoc transition checks. Code drifts into impossible states: submitted session gets edited by specialist, exported session gets modified, returned session submitted without addressing feedback.

**Why it happens:**
Each feature adds a transition without checking the full matrix. No explicit state machine.

**Prevention:**
Define transitions explicitly BEFORE writing code:
```
active     --[specialist submits]--> submitted
submitted  --[admin returns]------> returned
submitted  --[admin approves]-----> completed
returned   --[specialist submits]--> submitted
completed  --[admin archives]-----> archived
archived   (terminal)
```

Implement `canTransition(from, to, role)` on the server. Every status-changing endpoint calls it. Log all transitions with timestamps and actor.

**Rules to make explicit:**
- Specialist CANNOT edit submitted session (handed off)
- Admin CAN edit submitted session items (no status change needed)
- Exported/completed session cannot be un-exported
- Specialist sees read-only view of submitted sessions

---

### Pitfall 7: Cloudflare Worker CORS Wildcard Persists in Production

**What goes wrong:**
The existing proxy uses `Access-Control-Allow-Origin: *`. Any website can use the Gemini proxy, running up API costs.

**Why it happens:**
Wildcard is convenient in dev. "Fix before production" is said but not tracked as a blocking criterion.

**Prevention:**
1. Make CORS lockdown a blocking CI check.
2. Set origin to exact Vercel production domain.
3. For Vercel API routes (same-origin), CORS is not an issue. Only the CF Worker proxy needs lockdown.

---

### Pitfall 8: Zustand Persisted State Leaks Between Users

**What goes wrong:**
`uiStore` persists under static key `tpc-ui-state`. If admin completes walkthrough, specialist sees it skipped. `recordingSessionId` might reference a session the current user cannot access.

**Why it happens:**
Zustand persist has no user-scoping. Designed for single-user app.

**Prevention:**
1. User-scope the persist key: `name: \`tpc-ui-state-\${userId}\``
2. Clear state on logout: reset all Zustand stores, remove persist keys.
3. Validate cached `recordingSessionId` belongs to current user on login.

---

### Pitfall 9: Better Auth Cookie Not Sent Cross-Origin During Development

**What goes wrong:**
In local development, the Vite dev server runs on `https://localhost:5173` and the API (via `vercel dev`) runs on a different port. Better Auth sets an httpOnly cookie on the API origin. The cookie is NOT sent on requests from the Vite origin because they are different origins. Login succeeds but subsequent API calls fail with 401.

**Why it happens:**
Cookies are origin-scoped by default. `SameSite=Lax` cookies are not sent cross-origin. This only manifests in development (production is same-origin on Vercel).

**Prevention:**
1. Use Vite's proxy config to route `/api/*` requests to the API server. This makes all requests same-origin from the browser's perspective.
2. Alternatively, use `vercel dev` which serves both SPA and API on the same port.
3. Do NOT set `SameSite=None` or `credentials: 'include'` as a workaround -- this weakens security and masks the real issue.

**Detection:**
- Login works but useSession() returns null
- Network tab shows cookie set on API response but not sent on subsequent requests
- Works in production but breaks in dev

---

### Pitfall 10: Hono API Module Imports Fail on Vercel Due to Path Resolution

**What goes wrong:**
The Hono app in `api/index.ts` imports from `../server/auth.ts` and `../server/db/schema.ts`. Vercel's serverless function bundler cannot resolve imports outside the `api/` directory. Deployment succeeds but the function crashes with `ERR_MODULE_NOT_FOUND`.

**Why it happens:**
Vercel bundles each serverless function independently. It traces imports from the entry file but may not handle all path patterns correctly, especially TypeScript path aliases or relative imports that go "up" from the `api/` directory.

**Prevention:**
1. Keep the `api/index.ts` entry point. Import from `../server/*` using relative paths (not aliases).
2. If Vercel cannot resolve imports, move server code inside the `api/` directory: `api/lib/auth.ts`, `api/lib/db.ts`, etc.
3. Test with `vercel build` locally before pushing. Check the output `.vercel/output/functions` to verify bundling worked.
4. If path issues persist, add a `vercel.json` build override with a custom build command that bundles the API code.

**Detection:**
- Build succeeds but function returns 500 with module not found error
- Works with `vercel dev` but fails in production
- Error in Vercel function logs: `ERR_MODULE_NOT_FOUND`

---

## Moderate Pitfalls

### Pitfall 11: Better Auth Admin Plugin Role Name Mismatch

**What goes wrong:**
Better Auth's admin plugin uses `'user'` as the default non-admin role. TPC calls this role "specialist." If code checks `role === 'specialist'`, it never matches because the database stores `'user'`.

**Prevention:**
Decide once: use Better Auth's convention (`'admin'` and `'user'`). Map to display labels in the UI only. All code checks `role === 'admin'` or `role !== 'admin'`. Never check for `'specialist'` in business logic.

### Pitfall 12: Drizzle Schema Generation Conflicts with Better Auth Schema

**What goes wrong:**
Running `npx @better-auth/cli generate` creates a Drizzle schema for auth tables (user, session, account, verification). Running `npx drizzle-kit generate` then tries to manage these tables AND app tables. Conflicting migrations or duplicate table definitions.

**Prevention:**
1. Run Better Auth CLI first to generate auth table schema.
2. Put auth tables and app tables in the same `schema.ts` file.
3. Use Drizzle Kit for ALL migrations (including auth tables). Better Auth CLI is a one-time generator, not an ongoing migration tool.
4. After initial setup, manage all schema changes through Drizzle Kit only.

### Pitfall 13: Neon Postgres Scale-to-Zero Causes First-Request Latency

**What goes wrong:**
Neon's free tier scales to zero after 5 minutes of inactivity. First request after idle wakes the database, adding 1-3 seconds of latency on top of Vercel's cold start. The login request takes 4-5 seconds, feeling broken.

**Prevention:**
1. Accept it for a 2-5 user internal tool. First request after idle is slow; subsequent requests are fast.
2. If unacceptable: Neon's Launch plan ($19/mo) allows configuring a longer idle timeout or always-on.
3. Show a loading indicator on the login page to set expectations.
4. Do NOT add a keep-alive ping -- it defeats the purpose of scale-to-zero and costs CU-hours.

---

## Minor Pitfalls

### Pitfall 14: `vercel dev` Does Not Match Production Routing Exactly

**Prevention:** Always test with `vercel build && vercel deploy --prebuilt` to a preview URL before merging to main. Local dev routing can mask issues.

### Pitfall 15: Better Auth Email Field Required Despite Username-Only Auth

**What goes wrong:** Better Auth's user model requires an `email` field even when using the username plugin. Sign-up fails if email is not provided.

**Prevention:** Generate a placeholder email from username: `${username}@tpc.local`. This satisfies the schema constraint without requiring real email infrastructure.

### Pitfall 16: Drizzle Kit `push` vs `migrate` Confusion

**Prevention:** Use `drizzle-kit push` for rapid development (applies schema changes directly, no migration files). Use `drizzle-kit generate && drizzle-kit migrate` for production (creates versioned migration SQL files). Never use `push` in production.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Backend setup (Hono + Drizzle + Neon) | Module import paths fail on Vercel (#10) | Test `vercel build` early. Keep server code in `api/` or verify relative imports resolve. |
| Better Auth integration | Email required despite username-only (#15), role name mismatch (#11) | Placeholder email, use `'user'` not `'specialist'` in code. |
| Auth middleware | Cookie not sent cross-origin in dev (#9) | Use Vite proxy or `vercel dev` for local development. |
| Session lifecycle | State machine has implicit transitions (#6) | Define transition table before writing endpoints. |
| Service worker + API | SW caches API responses (#1) | Add `navigateFallbackDenylist` immediately when first API route is added. |
| Deployment | SPA 404 on refresh (#5), CORS wildcard (#7) | `vercel.json` rewrites, CORS lockdown as deployment gate. |
| Multi-user on shared device | Zustand state leaks (#8), cached API data | User-scoped persist keys, clear on logout. |
| Offline usage | App breaks when server down (#4) | Offline-aware auth, recording always works. |
| v1.0 data | Orphaned IndexedDB data (#3) | Export before upgrade, clean start on server. |
| First request latency | Neon scale-to-zero (#13) | Accept for free tier, show loading indicator. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Service worker exclusion:** API routes NOT cached by SW. Verify Network tab -- no "(from ServiceWorker)" on `/api/*` calls
- [ ] **Server-side role enforcement:** Every admin endpoint returns 403 when called with specialist credentials. Tested with curl, not just UI
- [ ] **Offline recording:** Login successfully, disconnect. Reopen app. Recording still works. Verify audio saved to Dexie
- [ ] **Vercel deep link:** Refresh browser at `/session/5` on deployed URL. Page loads, not 404
- [ ] **Cross-user state isolation:** Login as user A, logout, login as user B. Verify B sees own sessions, not A's
- [ ] **CORS lockdown:** CF Worker rejects requests from non-Vercel origins. Tested with curl
- [ ] **Session state machine:** Invalid transitions rejected by server (specialist exports, edit after archive). Tested via API
- [ ] **Cookie auth in dev:** Login works AND subsequent API calls authenticated in local development
- [ ] **Hono module resolution:** `vercel build` succeeds locally. Function does not crash with module not found in preview deployment
- [ ] **Better Auth schema:** `drizzle-kit generate` produces clean migrations that include auth tables. No conflicts with app tables

---

## Sources

- [Better Auth Hono integration](https://better-auth.com/docs/integrations/hono) -- CORS, session middleware, cookie handling (HIGH confidence)
- [Better Auth admin plugin](https://better-auth.com/docs/plugins/admin) -- role model, createUser API (HIGH confidence)
- [Better Auth username plugin](https://better-auth.com/docs/plugins/username) -- email requirement quirk (HIGH confidence)
- [Vercel community -- Hono API module not found](https://community.vercel.com/t/hono-api-on-vercel-crashes-with-err-module-not-found-when-importing-server-files/35901) -- module resolution issue (HIGH confidence)
- [Vercel -- Vite SPA routing](https://vercel.com/docs/frameworks/frontend/vite) -- SPA rewrite config (HIGH confidence)
- [Neon pricing -- scale-to-zero](https://neon.com/pricing) -- 5-minute idle timeout on free tier (HIGH confidence)
- [Workbox navigateFallbackDenylist](https://vite-pwa-org.netlify.app/workbox/generate-sw) -- excluding API routes (HIGH confidence)
- Codebase analysis: `vite.config.ts` (workbox config), `proxy/src/index.ts` (CORS wildcard), `src/stores/uiStore.ts` (persist key)

---
*Pitfalls research for: TPC Speech Cataloger v1.1 -- Accounts & Deploy*
*Researched: 2026-03-17*
