# Phase 12: Authentication - Research

**Researched:** 2026-03-18
**Domain:** Supabase Auth + React SPA route protection + PWA service worker exclusion
**Confidence:** HIGH

## Summary

Phase 12 adds email/password authentication to the TPC Catalog app using Supabase Auth JS SDK (bundled with `@supabase/supabase-js` installed in Phase 11). The implementation covers five areas: a login page, session persistence with auto-refresh, route protection for all app routes, password change in Settings, and service worker exclusion for Supabase API routes.

The Supabase Auth JS client handles all heavy lifting -- token storage in localStorage, automatic refresh before expiry, and `onAuthStateChange` event subscriptions. The React integration pattern uses a lightweight auth context (or Zustand store, consistent with existing patterns) that wraps the Supabase listener, exposes session/user state and a loading flag, and gates route rendering via a `ProtectedRoute` wrapper component. The service worker fix is a two-line addition to the existing `vite-plugin-pwa` Workbox config.

**Primary recommendation:** Use a Zustand auth store (matching the project's existing Zustand pattern) with `onAuthStateChange` to manage auth state, a `<ProtectedRoute>` layout wrapper using `<Navigate>` for redirect, and `runtimeCaching` with `NetworkOnly` handler to exclude Supabase routes from the service worker cache.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Login page: Full-screen centered card layout, vertically centered. "TPC Catalog" + subtitle above form. Email + password fields. Inline red error text below Sign In button. Sign In button disabled + spinner while in flight.
- Post-login: Always redirect to `/` (Sessions page). No return-to-URL logic. Bottom tab bar unchanged. All routes require auth -- every route redirects to `/login` if unauthenticated.
- Password change: Lives in Settings page as "Account" section. Inline expandable form (current password + new password + confirm fields). Uses established expandable pattern from ItemCard.
- Logout: "Sign Out" button in Settings > Actions section (alongside "Reset Walkthrough"). Requires ConfirmDialog confirmation. Local Dexie data NOT cleared on logout.
- Login route (`/login`) sits outside `AppLayout` wrapper -- no bottom nav on login screen.

### Claude's Discretion
- Service worker Supabase route exclusion implementation (Workbox `navigateFallbackDenylist` or `runtimeCaching` with `NetworkOnly` for `*.supabase.co` URLs)
- Auth state management architecture (React context, Zustand store, or Supabase SDK `onAuthStateChange`)
- Client-side form validation (before submit vs. only on error response)
- Exact Account section placement within Settings page
- Loading/error state animation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in with email and password via Supabase Auth | `signInWithPassword({ email, password })` API verified; login page design locked |
| AUTH-02 | Auth session managed by Supabase (automatic token refresh) | Supabase client auto-refreshes by default; `persistSession: true` stores in localStorage; `onAuthStateChange` emits `TOKEN_REFRESHED` events |
| AUTH-03 | Unauthenticated users are redirected to login page | `<ProtectedRoute>` wrapper checks session, redirects with `<Navigate to="/login" replace />` |
| AUTH-04 | User can change their own password | `supabase.auth.updateUser({ password })` -- works when "Secure password change" is disabled in dashboard (recommended for this internal app) |
| INFRA-04 | Service worker excludes Supabase API routes from caching | Workbox `runtimeCaching` with `NetworkOnly` handler for `*.supabase.co` URL pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.99.2 | Supabase client (auth, database, storage) | Already installed by Phase 11; bundles auth-js internally |
| react-router | 7.13.1 | Routing, `<Navigate>`, `<Outlet>` for auth guards | Already in project; v7 `Navigate` is the standard redirect mechanism |
| zustand | 5.0.11 | Auth state store (session, user, loading) | Already in project; matches existing `uiStore` pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-pwa | 1.2.0 | PWA / Workbox config for service worker | Already in project; add `runtimeCaching` for Supabase route exclusion |
| zod | 4.3.6 | Login/password form validation schemas | Already in project; optional for client-side validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand auth store | React Context + useReducer | Context is fine but Zustand is already the project pattern; consistency wins |
| Zustand auth store | Direct `onAuthStateChange` in each component | Duplicated logic, no central loading state, harder to test |
| `runtimeCaching` NetworkOnly | `navigateFallbackDenylist` | Denylist only affects navigation requests, not API fetch calls; `runtimeCaching` with `NetworkOnly` properly handles all fetch patterns |

**Installation:**
```bash
# No new packages needed -- all dependencies installed by Phase 11 or already present
```

**Version verification:** All versions confirmed via `npm view` on 2026-03-18.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    supabase.ts          # createClient singleton (exists from Phase 11)
  stores/
    authStore.ts         # Zustand store: session, user, loading, signIn, signOut, etc.
  components/
    ProtectedRoute.tsx   # Wraps <Outlet />, redirects to /login if not authenticated
  pages/
    Login.tsx            # Full-screen login page (outside AppLayout)
    Settings.tsx         # Add Account section + Sign Out button (modify existing)
  App.tsx                # Add /login route outside AppLayout, wrap others with ProtectedRoute
```

### Pattern 1: Zustand Auth Store with onAuthStateChange
**What:** A Zustand store that subscribes to `supabase.auth.onAuthStateChange` during initialization and exposes `session`, `user`, `loading`, and auth action methods.
**When to use:** App-wide auth state needed by multiple components (route guard, settings page, future role checks).
**Example:**
```typescript
// Source: Supabase official docs + project Zustand pattern
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;          // true until initial session check completes
  initialize: () => () => void;  // returns unsubscribe function
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  loading: true,

  initialize: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        set({
          session,
          user: session?.user ?? null,
          loading: false,
        });
      }
    );
    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut({ scope: 'local' });
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  },
}));
```

### Pattern 2: ProtectedRoute Layout Wrapper
**What:** A route layout component that checks auth loading/session state and either renders `<Outlet />` or redirects to `/login`.
**When to use:** Wrap all authenticated routes in the React Router tree.
**Example:**
```typescript
// Source: React Router v7 + Supabase auth pattern
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute() {
  const { session, loading } = useAuthStore();

  if (loading) {
    // Show loading spinner while session is being restored
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

### Pattern 3: Route Structure (Login Outside AppLayout)
**What:** The `/login` route lives outside the `AppLayout` wrapper so no bottom nav appears. All other routes are nested inside both `ProtectedRoute` and `AppLayout`.
**Example:**
```typescript
// Source: CONTEXT.md locked decision + react-router v7 nesting
<Routes>
  <Route path="login" element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>
    <Route element={<AppLayout />}>
      <Route index element={<SessionsPage />} />
      <Route path="new" element={<NewSessionPage />} />
      <Route path="session/:sessionId" element={<SessionDetailPage />} />
      <Route path="session/:sessionId/item/:itemId" element={<ItemEntryPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
  </Route>
</Routes>
```

### Pattern 4: Service Worker Supabase Route Exclusion
**What:** Add `runtimeCaching` entry with `NetworkOnly` handler to the Workbox config so Supabase API requests always reach the network.
**When to use:** Must be in place before any Supabase auth/data calls are made from the browser.
**Example:**
```typescript
// Source: vite-plugin-pwa docs + Workbox generateSW docs
VitePWA({
  // ...existing config...
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    // Exclude Supabase API routes from service worker caching
    navigateFallbackDenylist: [/^\/auth/],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
        handler: 'NetworkOnly',
      },
    ],
  },
}),
```

### Anti-Patterns to Avoid
- **Async callbacks in onAuthStateChange:** Never `await` Supabase methods inside the callback -- causes deadlocks. Use `setTimeout(..., 0)` if async work is needed.
- **Using getSession() for security decisions:** The user object from `getSession()` reads from localStorage and can be tampered with. For security-critical checks, use `getUser()` which validates against the server. For client-side UI gating (showing/hiding routes), `getSession()` is fine.
- **Not handling the INITIAL_SESSION event:** `onAuthStateChange` fires `INITIAL_SESSION` first with the restored session (or null). The loading state must wait for this before rendering routes.
- **Clearing Dexie on logout:** User decision locks that local data (audio blobs, photos) stays on device after logout.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token refresh | Manual timer checking JWT expiry | `supabase.auth.onAuthStateChange` + auto-refresh | Supabase client handles refresh automatically, including edge cases (tab backgrounding, clock skew) |
| Session storage | Manual localStorage read/write | Supabase client `persistSession: true` (default) | Handles serialization, expiry checks, cross-tab sync |
| Password hashing | Client-side bcrypt/argon2 | `supabase.auth.updateUser({ password })` | Server handles hashing; never hash passwords client-side |
| Loading spinner component | Custom animated SVG | Tailwind `animate-spin` on a border-based circle | Consistent with existing project styling, zero dependencies |
| Form validation for email | Custom regex | HTML5 `type="email"` + optional Zod schema | Browser validation catches obvious typos; Zod adds programmatic checking |

**Key insight:** Supabase Auth handles the entire auth lifecycle (sign in, token storage, auto-refresh, sign out). The app code only needs to: (1) listen to state changes, (2) gate routes based on session presence, and (3) call SDK methods for auth actions.

## Common Pitfalls

### Pitfall 1: Flash of Unauthenticated Content
**What goes wrong:** App briefly shows the login page before the stored session loads, even for authenticated users.
**Why it happens:** `onAuthStateChange` fires `INITIAL_SESSION` asynchronously after the client initializes. If the route guard renders before this event, it sees `session === null` and redirects.
**How to avoid:** Initialize the auth store in `main.tsx` (or a top-level effect) and render a full-screen loading spinner until `loading` becomes `false`.
**Warning signs:** Authenticated users see a flash of the login page on refresh.

### Pitfall 2: Deadlock in onAuthStateChange Callback
**What goes wrong:** App hangs or shows infinite loading spinner.
**Why it happens:** Using `await supabase.auth.someMethod()` inside the `onAuthStateChange` callback creates a deadlock because the callback runs synchronously during auth state processing.
**How to avoid:** Keep the callback synchronous -- only call `set()` on the store. Defer any async work with `setTimeout(() => { ... }, 0)`.
**Warning signs:** App freezes after login or on initial load.

### Pitfall 3: Service Worker Caching Auth Requests
**What goes wrong:** Auth token refresh returns stale/cached response; user appears logged in but API calls fail with 401.
**Why it happens:** Default Workbox precache + runtime cache intercepts fetch requests to `*.supabase.co`.
**How to avoid:** Add `runtimeCaching` with `NetworkOnly` handler for Supabase URLs. This must be configured BEFORE the first auth request.
**Warning signs:** Intermittent 401 errors, auth working in incognito but not normal browsing.

### Pitfall 4: signInWithPassword Error Messages Leak Account Existence
**What goes wrong:** Different error messages for "user not found" vs "wrong password" let attackers enumerate accounts.
**Why it happens:** Supabase deliberately returns a generic error message for both cases.
**How to avoid:** Display the exact error message from Supabase (`error.message`) without adding logic that differentiates error types. Show a single generic inline error for all auth failures.
**Warning signs:** UI shows different messages for different failure modes.

### Pitfall 5: Password Change Without Current Password Verification
**What goes wrong:** A session hijacker can change the password without knowing the current one.
**Why it happens:** By default, `updateUser({ password })` works without reauthentication if "Secure password change" is disabled.
**How to avoid:** For this internal 2-5 person team app, the risk is low. The CONTEXT.md specifies a "current password" field in the change password form. Verify current password client-side by calling `signInWithPassword` with the current credentials before calling `updateUser`. This provides reasonable security without enabling the nonce email flow.
**Warning signs:** Password change form has no "current password" field.

## Code Examples

Verified patterns from official sources:

### Supabase Client Initialization (from Phase 11)
```typescript
// Source: Supabase JS docs - createClient
// File: src/lib/supabase.ts (created in Phase 11)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Default options are correct for SPA:
// - persistSession: true (localStorage)
// - autoRefreshToken: true
// - detectSessionInUrl: true (for magic links / OAuth - not needed but harmless)
```

### Sign In with Password
```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'their-password',
});
// error.message is generic (doesn't reveal if account exists)
// data.session contains access_token, refresh_token, user
```

### Sign Out (Local Scope)
```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-signout
const { error } = await supabase.auth.signOut({ scope: 'local' });
// scope: 'local' only terminates current browser session
// Triggers SIGNED_OUT event on onAuthStateChange
```

### Update Password
```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-updateuser
const { data, error } = await supabase.auth.updateUser({
  password: 'new-password',
});
// User must be signed in
// Works without nonce when "Secure password change" is disabled
```

### Verify Current Password Before Change
```typescript
// Pattern: re-authenticate by signing in with current credentials
const { error: verifyError } = await supabase.auth.signInWithPassword({
  email: user.email!,
  password: currentPassword,
});
if (verifyError) {
  // Current password is wrong -- show error
  return;
}
// Now safe to update
const { error: updateError } = await supabase.auth.updateUser({
  password: newPassword,
});
```

### Auth Store Initialization in main.tsx
```typescript
// Source: Project pattern (Zustand store init)
import { useAuthStore } from './stores/authStore';

// Initialize auth listener before rendering
const unsubscribe = useAuthStore.getState().initialize();

// In StrictMode, React double-mounts -- but the store is external
// so this is safe. Cleanup on HMR:
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribe());
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `supabase.auth.signIn()` | `supabase.auth.signInWithPassword()` | supabase-js v2 (2022) | More explicit method names, better TypeScript types |
| `supabase.auth.session()` | `supabase.auth.getSession()` | supabase-js v2 (2022) | Async, returns `{ data, error }` pattern |
| `@supabase/auth-helpers-react` | Direct `onAuthStateChange` + context/store | 2024 | Auth helpers deprecated; official docs recommend direct SDK usage |
| anon key + service_role key | publishable key (`sb_publishable_xxx`) | 2025 | New key format being rolled out; both work currently |

**Deprecated/outdated:**
- `@supabase/auth-helpers-react`: Deprecated. Do not install. Use `onAuthStateChange` directly.
- `supabase.auth.signIn()`: Removed in v2. Use `signInWithPassword()`.
- `supabase.auth.session()`: Removed in v2. Use `getSession()`.

## Open Questions

1. **Supabase "Secure password change" dashboard setting**
   - What we know: When disabled, `updateUser({ password })` works without nonce. When enabled, requires email OTP flow.
   - What's unclear: Default state for new Supabase projects (likely disabled by default based on docs).
   - Recommendation: Keep disabled for this internal app. The client-side "verify current password" pattern (calling `signInWithPassword` first) provides adequate security for a 2-5 person team.

2. **Phase 11 Supabase client file location**
   - What we know: Phase 11 will create the Supabase client singleton. CONTEXT.md says it will be at `src/lib/supabase.ts` or similar.
   - What's unclear: Exact path depends on Phase 11 implementation.
   - Recommendation: Plan should reference `src/lib/supabase.ts` as the expected location. If Phase 11 uses a different path, adjust at implementation time.

3. **Deactivated account handling**
   - What we know: Phase 13 adds account deactivation (ACCT-03). Phase 12 login should handle the case where a deactivated user tries to log in.
   - What's unclear: How deactivation is enforced -- RLS policy, auth hook, or application-level check.
   - Recommendation: Phase 12 should display the generic Supabase error message for deactivated accounts. The CONTEXT.md already lists "deactivated account" as an error case for the login page. Phase 13 will implement the deactivation mechanism; Phase 12 just needs to display whatever error Supabase returns.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (test section) |
| Setup file | `src/tests/setup.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | signIn calls supabase.auth.signInWithPassword and handles success/error | unit | `npx vitest run src/tests/auth-store.test.ts -t "signIn"` | Wave 0 |
| AUTH-01 | Login page renders form, shows errors, disables button during submit | unit (component) | `npx vitest run src/tests/login-page.test.tsx -t "login"` | Wave 0 |
| AUTH-02 | Auth store initializes from onAuthStateChange, sets loading=false after INITIAL_SESSION | unit | `npx vitest run src/tests/auth-store.test.ts -t "initialize"` | Wave 0 |
| AUTH-03 | ProtectedRoute redirects to /login when no session, renders Outlet when authenticated | unit (component) | `npx vitest run src/tests/protected-route.test.tsx` | Wave 0 |
| AUTH-04 | updatePassword calls supabase.auth.updateUser and handles errors | unit | `npx vitest run src/tests/auth-store.test.ts -t "updatePassword"` | Wave 0 |
| AUTH-04 | Password change form validates matching passwords and shows errors | unit (component) | `npx vitest run src/tests/password-change.test.tsx` | Wave 0 |
| INFRA-04 | Workbox config includes NetworkOnly handler for supabase.co URLs | unit | `npx vitest run src/tests/pwa-config.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/auth-store.test.ts` -- covers AUTH-01, AUTH-02, AUTH-04 (store actions and initialization)
- [ ] `src/tests/login-page.test.tsx` -- covers AUTH-01 (login page UI and form behavior)
- [ ] `src/tests/protected-route.test.tsx` -- covers AUTH-03 (redirect behavior)
- [ ] `src/tests/password-change.test.tsx` -- covers AUTH-04 (password change form UI)
- [ ] `src/tests/pwa-config.test.ts` -- covers INFRA-04 (Workbox config verification; may extend existing `pwa-manifest.test.ts`)

Note: All tests will need to mock `@supabase/supabase-js` since there is no local Supabase instance. Mock the `supabase.auth` methods and simulate `onAuthStateChange` callbacks.

## Sources

### Primary (HIGH confidence)
- [Supabase signInWithPassword docs](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) -- API signature, error handling behavior
- [Supabase onAuthStateChange docs](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) -- Event types, async callback warning, INITIAL_SESSION event
- [Supabase session management docs](https://supabase.com/docs/guides/auth/sessions) -- Token lifecycle, auto-refresh, persistence
- [Supabase updateUser docs](https://supabase.com/docs/reference/javascript/auth-updateuser) -- Password update API, nonce parameter
- [Supabase signOut docs](https://supabase.com/docs/reference/javascript/auth-signout) -- Scope options (local/global/others)
- [Supabase getSession docs](https://supabase.com/docs/reference/javascript/auth-getsession) -- Security warnings about user object trustworthiness
- [Supabase reauthenticate docs](https://supabase.com/docs/reference/javascript/auth-reauthentication) -- Nonce flow for secure password change
- [Supabase password-based auth docs](https://supabase.com/docs/guides/auth/passwords) -- Password change flows, reauthentication requirements
- [vite-plugin-pwa generateSW docs](https://vite-pwa-org.netlify.app/workbox/generate-sw) -- navigateFallbackDenylist, runtimeCaching, NetworkOnly handler
- npm registry -- `@supabase/supabase-js@2.99.2`, `vite-plugin-pwa@1.2.0` version verification

### Secondary (MEDIUM confidence)
- [React Router v7 protected routes patterns](https://www.robinwieruch.de/react-router-private-routes/) -- ProtectedRoute component pattern with Navigate
- [Building Reliable Protected Routes with React Router v7](https://dev.to/ra1nbow1/building-reliable-protected-routes-with-react-router-v7-1ka0) -- Auth guard layout wrapper
- [Supabase React quickstart](https://supabase.com/docs/guides/auth/quickstarts/react) -- Client setup, auth state pattern
- [Supabase auth discussions](https://github.com/orgs/supabase/discussions/34323) -- Secure password change behavior clarification

### Tertiary (LOW confidence)
- [Supabase reauthentication default behavior](https://github.com/orgs/supabase/discussions/7310) -- Whether reauthentication is required by default on new projects (conflicting reports; verify in dashboard)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, versions verified via npm registry
- Architecture: HIGH -- patterns verified against official Supabase docs and react-router v7 docs; consistent with project's existing Zustand/react-router patterns
- Pitfalls: HIGH -- deadlock warning directly from official docs; flash-of-content is well-documented pattern; service worker issue called out in project STATE.md
- Password change flow: MEDIUM -- exact default for "Secure password change" on new projects unclear; recommendation to keep it disabled is safe for internal app

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (30 days -- Supabase Auth is stable, no breaking changes expected)
