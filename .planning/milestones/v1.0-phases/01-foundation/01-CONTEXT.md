# Phase 1: Foundation - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

PWA shell with Dexie schema, shared TypeScript types, pathname routing (React Router v7), and Tailwind CSS 4. Auctioneers can install the app on their phone home screen and open a working mobile-optimized shell with correct routing and persistent storage schema. No recording, AI, or export functionality — just the installable shell and data layer.

</domain>

<decisions>
## Implementation Decisions

### Shell Layout
- Bottom tab bar with 3 tabs: Sessions / New / Settings
- "New" tab opens a mode picker (house visit vs sale cataloging)
- First-time users see a 2-3 step welcome walkthrough explaining the two modes
- After first onboarding, home screen shows a big "Start New Session" CTA when no sessions exist
- Sessions list is a simple list: session name, mode (house/sale icon), item count, date — tap to resume

### Visual Style
- Professional minimal aesthetic — clean whites/grays, content-forward (think Notion/Linear)
- Light and dark mode, follows system preference automatically
- Blue accent color for buttons, active states, and highlights

### PWA Install Experience
- Splash/loading screen shows "TPC Catalog" text on white background (no logo)
- Home screen label: "TPC Catalog"
- Blue status bar at top when app is open
- Custom install banner: dismissable bar saying "Install TPC Catalog for the best experience" with install button
- Standalone display mode (no browser chrome)

### Dexie Schema Design
- Separate tables per cataloging mode: `houseVisitItems` and `saleItems` (each with mode-specific fields, no nulls)
- Photos resized to ~2048px max dimension before storage — balances quality for RFC upload with IndexedDB size limits
- Photos stored in their own dedicated Dexie table, linked to items by ID
- Audio blobs stored in their own dedicated Dexie table, linked to items by ID
- Photos must flow through export pipeline to Chrome extension to RFC Invaluable (not just for in-app reference)

### Claude's Discretion
- Exact walkthrough content and step count
- Typography choices and spacing
- Loading states and transitions
- Dexie table indexing strategy
- Service worker caching strategy

</decisions>

<specifics>
## Specific Ideas

- Sessions list should feel like a simple productivity app — not cluttered
- 300+ photos per house visit session is common — schema must handle this without hitting Safari storage limits
- App is for 2-5 auctioneers, no accounts needed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing codebase

### Established Patterns
- Stack locked: React 19 + Vite 7 + TypeScript 5 + Tailwind CSS 4 + Zustand 5 + Dexie 4 + React Router v7
- Pathname-based routing (not hash) — required to prevent iOS microphone re-prompts on navigation

### Integration Points
- Dexie schema defined here will be used by all subsequent phases (audio capture, sessions, cataloging modes)
- TypeScript types defined here become the shared contract between PWA and Chrome extension
- PWA manifest and service worker set up here enable offline capability in Phase 8

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-06*
