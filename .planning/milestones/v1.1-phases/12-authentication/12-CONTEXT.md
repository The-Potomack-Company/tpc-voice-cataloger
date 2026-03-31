# Phase 12: Authentication - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Login page, Supabase Auth session management, route protection for all app routes, password change, and service worker fix to exclude Supabase API routes from caching. Users must be authenticated to access any part of the app. Account creation and role management are Phase 13.

</domain>

<decisions>
## Implementation Decisions

### Login page design
- Full-screen centered card layout, vertically centered on the screen
- App name "TPC Catalog" + subtitle "Speech-to-catalog tool for auctioneers" above the form
- Fields: email + password
- Inline red error text below the Sign In button for all error cases (wrong password, invalid email, deactivated account)
- Sign In button disabled + spinner while auth request is in flight (prevents double-submit)

### Post-login navigation
- Always redirect to `/` (Sessions page) after successful login — no return-to-URL logic
- Bottom tab bar unchanged after login — no user indicator, no visual changes to Sessions/New/Settings tabs
- All routes require authentication — every route redirects to `/login` if unauthenticated, no public routes

### Password change
- Lives in Settings page as a new "Account" section (above or alongside existing sections)
- Inline expandable form — the "Change Password" row expands in place to reveal current password + new password + confirm fields
- Consistent with the expandable pattern used in ItemCard and export history rows

### Logout
- "Sign Out" button in the Settings page → Actions section (alongside "Reset Walkthrough")
- Requires a ConfirmDialog confirmation before signing out
- Local Dexie data (audio blobs, photos) is NOT cleared on logout — data stays on device

### Claude's Discretion
- Service worker Supabase route exclusion implementation (Workbox `navigateFallbackDenylist` or `runtimeCaching` with `NetworkOnly` for `*.supabase.co` URLs)
- Auth state management architecture (React context, Zustand store, or Supabase SDK `onAuthStateChange`)
- Client-side form validation (before submit vs. only on error response)
- Exact Account section placement within Settings page
- Loading/error state animation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 (email/password login), AUTH-02 (session persistence + auto-refresh), AUTH-03 (redirect unauthenticated), AUTH-04 (change own password), INFRA-04 (service worker excludes Supabase routes)

### Phase scope & success criteria
- `.planning/ROADMAP.md` — Phase 12 goal and success criteria (5 items)

### No external Supabase specs — Supabase Auth JS SDK docs should be fetched during research

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/layouts/AppLayout.tsx`: Wraps all current routes; auth guard logic can live here or in a new `AuthLayout` wrapper added above `AppLayout` in the route tree
- `src/pages/Settings.tsx`: Has 4 sections (About, Storage, Deleted Sessions, Actions); add "Account" section for Change Password + extend Actions for Sign Out
- `src/components/ConfirmDialog.tsx`: Already exists; reuse for logout confirmation
- `src/App.tsx`: Clean Routes/Route setup; `/login` route should sit outside the `AppLayout` wrapper so the bottom nav doesn't appear on the login screen

### Established Patterns
- Workbox PWA configured in `vite.config.ts` via `vite-plugin-pwa`; Supabase API route exclusion must be added to the Workbox config here
- Expandable row pattern (ItemCard, export history) is the established UI idiom — use it for the Change Password form in Settings
- Professional minimal aesthetic: whites/grays, blue accent (`text-accent`, `bg-accent`), light/dark mode via Tailwind dark: prefix
- `min-h-12` tap targets on all interactive elements (established in Phase 1)

### Integration Points
- `src/App.tsx` → add `/login` route outside `AppLayout`, wrap existing routes with auth guard
- `vite.config.ts` → add Supabase URL exclusion to Workbox config
- `src/pages/Settings.tsx` → add Account section + Sign Out to Actions

</code_context>

<specifics>
## Specific Ideas

- No specific references cited — open to standard Supabase Auth JS v2 patterns
- Login page visual should match the Phase 1 splash screen: "TPC Catalog" on white, blue accent button

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-authentication*
*Context gathered: 2026-03-17*
