# Phase 1: Foundation - Research

**Researched:** 2026-03-06
**Domain:** PWA shell, React 19 + Vite 7 + Tailwind CSS 4 + React Router v7 + Dexie 4 + Zustand 5
**Confidence:** HIGH

## Summary

Phase 1 delivers an installable PWA shell with bottom tab navigation, Dexie storage schema, shared TypeScript types, pathname-based routing, and mobile-optimized layout. The stack is fully locked: React 19, Vite 7, TypeScript 5, Tailwind CSS 4, Zustand 5, Dexie 4, and React Router v7 in declarative (library) mode. This is a greenfield project targeting mobile-first use by auctioneers on iOS Safari and Android Chrome.

The key technical challenges are: (1) iOS PWA quirks around install experience and storage limits, (2) Dexie schema design that handles 300+ photos per session without hitting Safari storage limits, (3) mobile-first layout with 48px+ tap targets and one-handed thumb-zone accessibility, and (4) dark/light mode following system preference via Tailwind CSS 4.

**Primary recommendation:** Set up the Vite 7 project with vite-plugin-pwa for service worker generation, use React Router v7 in declarative mode with BrowserRouter (not framework mode), define Dexie schema with separate blob tables (photos, audio) that are NOT indexed, and build a bottom-tab layout with Tailwind CSS 4 responsive utilities.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bottom tab bar with 3 tabs: Sessions / New / Settings
- "New" tab opens a mode picker (house visit vs sale cataloging)
- First-time users see a 2-3 step welcome walkthrough explaining the two modes
- After first onboarding, home screen shows a big "Start New Session" CTA when no sessions exist
- Sessions list: session name, mode (house/sale icon), item count, date — tap to resume
- Professional minimal aesthetic — clean whites/grays, content-forward (think Notion/Linear)
- Light and dark mode, follows system preference automatically
- Blue accent color for buttons, active states, and highlights
- Splash/loading screen shows "TPC Catalog" text on white background (no logo)
- Home screen label: "TPC Catalog"
- Blue status bar at top when app is open
- Custom install banner: dismissable bar saying "Install TPC Catalog for the best experience" with install button
- Standalone display mode (no browser chrome)
- Separate tables per cataloging mode: `houseVisitItems` and `saleItems` (each with mode-specific fields, no nulls)
- Photos resized to ~2048px max dimension before storage
- Photos stored in their own dedicated Dexie table, linked to items by ID
- Audio blobs stored in their own dedicated Dexie table, linked to items by ID
- Photos must flow through export pipeline to Chrome extension to RFC Invaluable
- Stack: React 19 + Vite 7 + TypeScript 5 + Tailwind CSS 4 + Zustand 5 + Dexie 4 + React Router v7
- Pathname-based routing (not hash) — required to prevent iOS microphone re-prompts on navigation

### Claude's Discretion
- Exact walkthrough content and step count
- Typography choices and spacing
- Loading states and transitions
- Dexie table indexing strategy
- Service worker caching strategy

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | App is installable as a PWA on phone and tablet | PWA manifest config, vite-plugin-pwa setup, iOS/Android install experience research |
| UX-02 | UI uses large tap targets (min 48px) optimized for thumb-zone interaction | Tailwind CSS 4 sizing utilities, mobile-first layout patterns |
| UX-03 | App works in both portrait and landscape orientation | Tailwind responsive/orientation utilities, viewport meta tag configuration |
| UX-04 | Recording and navigation controls are accessible one-handed | Bottom tab bar pattern, thumb-zone layout research, fixed positioning patterns |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x | UI framework | Locked by project decision |
| react-dom | 19.x | DOM rendering | Pairs with React 19 |
| vite | 7.x | Build tool & dev server | Locked; latest stable is 7.3.x |
| typescript | 5.x | Type safety | Locked by project decision |
| tailwindcss | 4.x | Utility-first CSS | Locked; v4 uses first-party Vite plugin |
| @tailwindcss/vite | 4.x | Tailwind Vite integration | Required for Tailwind CSS 4 + Vite |
| react-router | 7.x | Client-side routing | Locked; use declarative mode (BrowserRouter) |
| zustand | 5.x | Client state management | Locked; for UI state like active tab, walkthrough progress |
| dexie | 4.x | IndexedDB wrapper | Locked; for all persistent data |
| dexie-react-hooks | 4.x | Reactive Dexie queries in React | useLiveQuery for reactive UI updates from IndexedDB |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-pwa | 1.x | PWA manifest + service worker generation | Required for installability, uses Workbox under the hood |
| @vitejs/plugin-react | latest | React Fast Refresh for Vite | Required for React + Vite dev experience |

### Dev Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | latest | Unit/component testing | Test framework aligned with Vite |
| @testing-library/react | latest | React component testing | DOM-based component testing |
| @testing-library/jest-dom | latest | DOM assertion matchers | Extended expect matchers for DOM |
| @testing-library/user-event | latest | User interaction simulation | Simulating clicks, typing |
| jsdom | latest | Simulated browser environment | Test environment for Vitest |

**Installation:**
```bash
npm create vite@latest tpc-catalog -- --template react-ts
cd tpc-catalog
npm install react-router zustand dexie dexie-react-hooks
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/          # Shared UI components (Button, TabBar, InstallBanner)
│   └── ui/              # Primitive UI elements
├── layouts/             # Layout shells (AppLayout with bottom tabs)
├── pages/               # Route-level components (Sessions, NewSession, Settings)
├── db/                  # Dexie database definition and schema
│   ├── index.ts         # Database class and table definitions
│   └── types.ts         # TypeScript interfaces for all entities
├── stores/              # Zustand stores (UI state, walkthrough state)
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── assets/              # Static assets (icons, splash screens)
├── App.tsx              # Root component with BrowserRouter and routes
├── main.tsx             # Entry point, renders App
└── index.css            # Tailwind import + custom properties
public/
├── manifest.webmanifest # PWA manifest (generated by vite-plugin-pwa)
├── icons/               # PWA icons (192x192, 512x512, maskable)
└── apple-touch-icon.png # iOS home screen icon (180x180)
```

### Pattern 1: React Router v7 Declarative Mode
**What:** Use BrowserRouter with Routes/Route components (library mode, NOT framework mode)
**When to use:** SPA without SSR — this project has no server
**Example:**
```typescript
// src/main.tsx
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// src/App.tsx
import { Routes, Route } from "react-router";
import { AppLayout } from "./layouts/AppLayout";
import { SessionsPage } from "./pages/Sessions";
import { NewSessionPage } from "./pages/NewSession";
import { SettingsPage } from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<SessionsPage />} />
        <Route path="new" element={<NewSessionPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
```

### Pattern 2: Dexie Database with TypeScript
**What:** Typed Dexie database class with separate blob tables
**When to use:** All persistent data in this app
**Example:**
```typescript
// src/db/types.ts
export interface Session {
  id?: string;       // Auto-generated UUID
  name: string;
  mode: "house" | "sale";
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseVisitItem {
  id?: string;
  sessionId: string;
  title?: string;
  description?: string;
  condition?: string;
  estimate?: string;
  category?: string;
  sortOrder: number;
  createdAt: Date;
}

export interface SaleItem {
  id?: string;
  sessionId: string;
  receiptNumber?: string;
  title?: string;
  description?: string;
  condition?: string;
  estimate?: string;
  category?: string;
  sortOrder: number;
  createdAt: Date;
}

export interface ItemPhoto {
  id?: string;
  itemId: string;
  itemType: "house" | "sale";
  blob: Blob;          // NOT indexed
  thumbnail?: Blob;    // NOT indexed
  sortOrder: number;
  createdAt: Date;
}

export interface ItemAudio {
  id?: string;
  itemId: string;
  itemType: "house" | "sale";
  blob: Blob;          // NOT indexed
  mimeType: string;    // "audio/mp4" (iOS) or "audio/webm;codecs=opus" (Android)
  durationMs?: number;
  createdAt: Date;
}

// src/db/index.ts
import Dexie, { type EntityTable } from "dexie";
import type { Session, HouseVisitItem, SaleItem, ItemPhoto, ItemAudio } from "./types";

const db = new Dexie("TPCCatalog") as Dexie & {
  sessions: EntityTable<Session, "id">;
  houseVisitItems: EntityTable<HouseVisitItem, "id">;
  saleItems: EntityTable<SaleItem, "id">;
  photos: EntityTable<ItemPhoto, "id">;
  audio: EntityTable<ItemAudio, "id">;
};

db.version(1).stores({
  sessions: "++id, mode, createdAt",
  houseVisitItems: "++id, sessionId, sortOrder",
  saleItems: "++id, sessionId, receiptNumber, sortOrder",
  photos: "++id, itemId, sortOrder",       // blob NOT indexed
  audio: "++id, itemId",                   // blob NOT indexed
});

export { db };
```

### Pattern 3: Tailwind CSS 4 Dark Mode with System Preference
**What:** Follow OS dark/light mode preference automatically
**When to use:** User decision says "follows system preference automatically"
**Example:**
```css
/* src/index.css */
@import "tailwindcss";

/* Tailwind CSS 4 uses prefers-color-scheme by default (media strategy) */
/* No additional config needed — dark: variants activate on OS preference */

@theme {
  --color-accent: #2563eb;          /* Blue-600 */
  --color-accent-hover: #1d4ed8;    /* Blue-700 */
}
```
```tsx
{/* Component using dark mode */}
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <button className="bg-accent text-white min-h-12 min-w-12 px-6 py-3">
    Start Session
  </button>
</div>
```

### Pattern 4: Bottom Tab Bar Layout
**What:** Fixed bottom navigation with three tabs, Outlet for page content
**When to use:** Main app shell — all pages render inside this layout
**Example:**
```tsx
// src/layouts/AppLayout.tsx
import { Outlet, NavLink } from "react-router";

export function AppLayout() {
  return (
    <div className="flex flex-col h-dvh bg-white dark:bg-gray-900">
      {/* Install banner (dismissable, shown at top) */}
      {/* Main content area — scrollable */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {/* Bottom tab bar — fixed, always visible */}
      <nav className="flex items-center justify-around border-t
                      border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-900
                      pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/" className={({ isActive }) =>
          `flex flex-col items-center py-3 px-4 min-h-12 min-w-12
           ${isActive ? "text-accent" : "text-gray-500 dark:text-gray-400"}`
        }>
          {/* Sessions icon */}
          <span className="text-xs mt-1">Sessions</span>
        </NavLink>
        <NavLink to="/new" className={/* same pattern */}>
          {/* New icon */}
          <span className="text-xs mt-1">New</span>
        </NavLink>
        <NavLink to="/settings" className={/* same pattern */}>
          {/* Settings icon */}
          <span className="text-xs mt-1">Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
```

### Pattern 5: PWA Install Banner (Custom)
**What:** Capture beforeinstallprompt and show custom dismissable banner
**When to use:** Android/desktop Chrome; iOS needs separate guidance (no beforeinstallprompt)
**Example:**
```tsx
import { useState, useEffect } from "react";

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("install-banner-dismissed") === "true"
  );
  const [isStandalone, setIsStandalone] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed || !deferredPrompt) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("install-banner-dismissed", "true");
  };

  return (
    <div className="flex items-center justify-between px-4 py-3
                    bg-accent text-white text-sm">
      <span>Install TPC Catalog for the best experience</span>
      <div className="flex gap-2">
        <button onClick={handleInstall}
                className="px-3 py-1.5 bg-white text-accent rounded min-h-10">
          Install
        </button>
        <button onClick={handleDismiss} className="px-2 min-h-10">
          &times;
        </button>
      </div>
    </div>
  );
}
```

### Pattern 6: Zustand Store for UI State
**What:** Lightweight UI state that does NOT belong in IndexedDB
**When to use:** Walkthrough completion, active tab highlight, banner dismiss state
**Example:**
```typescript
// src/stores/uiStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  hasCompletedWalkthrough: boolean;
  completeWalkthrough: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      hasCompletedWalkthrough: false,
      completeWalkthrough: () => set({ hasCompletedWalkthrough: true }),
    }),
    { name: "tpc-ui-state" } // persists to localStorage
  )
);
```

### Anti-Patterns to Avoid
- **Hash routing (#/):** Causes iOS Safari to re-prompt for microphone permission on every "navigation." Use pathname routing with BrowserRouter only.
- **Indexing blob columns in Dexie:** Slows down the database dramatically and can crash it. Never index `blob`, `thumbnail`, or similar binary fields.
- **Storing blobs in React state:** Large blobs (photos, audio) must go directly to Dexie, never held in component state or Zustand. Memory pressure on mobile will crash the app.
- **Using React Router framework mode:** Framework mode pulls in SSR tooling, file-based routing, and a Vite plugin replacement. This project is a pure SPA — use declarative mode.
- **Forgetting safe-area-inset:** iOS PWA standalone mode has a notch/dynamic island. Use `env(safe-area-inset-*)` padding on the tab bar and top of the app.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker | Custom SW registration & caching | vite-plugin-pwa (Workbox) | Cache invalidation, precaching manifests, update prompts are deceptively complex |
| PWA manifest | Hand-write manifest.json | vite-plugin-pwa manifest config | Auto-generates icons list, handles scope/start_url correctly |
| IndexedDB access | Raw IndexedDB API | Dexie 4 | Versioning, migrations, reactive queries, transaction handling |
| CSS utilities | Custom CSS framework | Tailwind CSS 4 | Responsive, dark mode, spacing all handled; 48px targets trivial with min-h-12/min-w-12 |
| Client routing | Custom history management | React Router v7 | Handles back button, deep linking, nested layouts |

**Key insight:** Every "simple" thing on this list has 10+ edge cases. Service workers alone have cache versioning, update prompts, navigation preloading, and offline fallback concerns. Dexie handles IndexedDB's notoriously painful versioning/migration story.

## Common Pitfalls

### Pitfall 1: iOS PWA Storage Eviction
**What goes wrong:** iOS Safari evicts IndexedDB data after ~7 days if the PWA isn't used, or when device storage is low.
**Why it happens:** WebKit's storage policy for web apps. Home-screen PWAs get more generous quota (up to 60% of disk), but unused data can still be purged.
**How to avoid:** (1) Store the PWA on the home screen (not just in browser tabs). (2) Design for data loss — sessions can be re-created. (3) The export flow (Phase 6) is the durable backup. (4) Consider showing a warning if storage usage is high.
**Warning signs:** Users report losing sessions after not using the app for a week.

### Pitfall 2: Missing Viewport Meta Tag
**What goes wrong:** App doesn't scale correctly on mobile; user can pinch-zoom and break layout.
**Why it happens:** Default Vite template may not include all needed viewport settings.
**How to avoid:** Ensure index.html has: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">`
**Warning signs:** Layout looks wrong on phone, user can zoom and pan.

### Pitfall 3: Safe Area Insets on Notched Devices
**What goes wrong:** Bottom tab bar sits behind the home indicator; top content sits behind the notch/Dynamic Island.
**Why it happens:** Standalone PWA mode on notched iPhones doesn't add automatic padding.
**How to avoid:** Use `viewport-fit=cover` in the viewport meta tag and apply `env(safe-area-inset-bottom)` padding to the tab bar and `env(safe-area-inset-top)` to the top of the app.
**Warning signs:** Bottom tabs are unclickable on iPhone 12+ devices.

### Pitfall 4: beforeinstallprompt Not Firing on iOS
**What goes wrong:** Custom install banner never appears on iOS Safari.
**Why it happens:** iOS Safari does NOT support the beforeinstallprompt event. Only Chrome/Edge on Android and desktop support it.
**How to avoid:** Detect iOS (user agent check) and show a manual instruction banner: "Tap the share icon, then 'Add to Home Screen'." Only show the programmatic install button on platforms that support beforeinstallprompt.
**Warning signs:** iOS users never see an install prompt.

### Pitfall 5: Dexie Schema Versioning Mistakes
**What goes wrong:** Changing the schema after initial release breaks existing users' databases.
**Why it happens:** IndexedDB schema changes require explicit version bumps and migration logic.
**How to avoid:** Design the v1 schema carefully — include all tables and indexes you'll need through Phase 8. Adding new tables in later versions is fine; changing indexes on existing tables requires migration code.
**Warning signs:** Users get errors after an app update.

### Pitfall 6: Tailwind CSS 4 Config File Confusion
**What goes wrong:** Developer creates tailwind.config.js, which is ignored in v4.
**Why it happens:** Tailwind CSS 4 uses CSS-based configuration (@theme in CSS files), not JavaScript config files.
**How to avoid:** All customization goes in `src/index.css` using `@theme { }` blocks. No tailwind.config.js needed.
**Warning signs:** Custom colors/spacing don't work.

## Code Examples

### Vite Configuration
```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "TPC Catalog",
        short_name: "TPC Catalog",
        description: "Speech-to-catalog tool for auctioneers",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Don't precache large assets; runtime cache them instead
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
```

### HTML Meta Tags for PWA
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#2563eb" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="TPC Catalog" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>TPC Catalog</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### Dynamic Viewport Height (dvh)
```tsx
// Use h-dvh instead of h-screen for mobile browsers
// h-screen = 100vh which includes the browser chrome on mobile
// h-dvh = 100dvh which adjusts for the actual visible area
<div className="h-dvh flex flex-col">
  <main className="flex-1 overflow-y-auto">...</main>
  <nav className="shrink-0">...</nav>
</div>
```

### Responsive Orientation Handling
```tsx
// Tailwind CSS 4 supports orientation variants
<div className="portrait:flex-col landscape:flex-row">
  {/* Adjust layout based on orientation */}
</div>

// For the tab bar, keep it at bottom in both orientations
// but adjust content layout for landscape width
<main className="flex-1 overflow-y-auto
                 portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto">
  {/* Content */}
</main>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | CSS-based @theme config | Tailwind CSS 4 (2025) | No JS config file needed; faster builds |
| PostCSS plugin for Tailwind | @tailwindcss/vite plugin | Tailwind CSS 4 (2025) | Direct Vite integration, simpler setup |
| 100vh for full height | 100dvh (h-dvh) | Modern CSS (2023+) | Fixes mobile browser chrome overlap |
| React Router v6 createBrowserRouter | React Router v7 BrowserRouter (declarative) | 2025 | v7 available but declarative mode unchanged |
| Zustand v4 create() | Zustand v5 create() with useSyncExternalStore | 2024 | Better React 18/19 compat, same API surface |

**Deprecated/outdated:**
- `tailwind.config.js` / `tailwind.config.ts`: Not used in Tailwind CSS 4. Use `@theme` in CSS.
- `@tailwindcss/postcss`: Replaced by `@tailwindcss/vite` for Vite projects.
- `100vh` on mobile: Always use `dvh` units via Tailwind's `h-dvh`.

## Open Questions

1. **Apple Touch Icon Generation**
   - What we know: iOS needs a 180x180 PNG for the home screen icon
   - What's unclear: Whether to generate icons manually or use a tool
   - Recommendation: Create a simple text-based icon ("TPC") using a design tool or canvas. Ship static PNGs in public/icons/. No build-time generation needed for an internal tool used by 2-5 people.

2. **iOS Install Banner Wording**
   - What we know: iOS doesn't support beforeinstallprompt; users must use Share > Add to Home Screen
   - What's unclear: Best UX for guiding iOS users through the manual install flow
   - Recommendation: Show a dismissable banner with platform-specific instructions. On iOS: "To install, tap [share icon] then 'Add to Home Screen'". Dismiss state saved in localStorage.

3. **Dexie Auto-Increment vs UUID for Primary Keys**
   - What we know: Dexie supports both `++id` (auto-increment) and manual string IDs
   - What's unclear: Whether UUIDs are needed for future cross-device sync
   - Recommendation: Use `++id` (auto-increment integer) for simplicity. No cloud sync is planned. If needed later, migration can add a UUID column.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, aligned with Vite 7) |
| Config file | vitest config embedded in vite.config.ts (test property) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | PWA manifest has required fields (name, display:standalone, icons) | unit | `npx vitest run src/tests/pwa-manifest.test.ts -t "manifest"` | No — Wave 0 |
| UX-02 | All interactive elements have min 48px tap targets | manual-only | Visual inspection on device | N/A — CSS-level, not unit-testable |
| UX-03 | Layout container uses h-dvh and doesn't overflow horizontally | unit | `npx vitest run src/tests/layout.test.ts -t "orientation"` | No — Wave 0 |
| UX-04 | Bottom tab bar renders with all 3 tabs, is fixed at bottom | unit | `npx vitest run src/tests/layout.test.ts -t "tab-bar"` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `vite.config.ts` — add `test` config block with jsdom environment, globals, setupFiles
- [ ] `src/tests/setup.ts` — import @testing-library/jest-dom matchers
- [ ] `src/tests/pwa-manifest.test.ts` — validates manifest fields for UX-01
- [ ] `src/tests/layout.test.ts` — validates tab bar rendering for UX-03, UX-04
- [ ] `src/tests/db.test.ts` — validates Dexie schema creation and basic CRUD
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 official docs](https://tailwindcss.com/docs) — installation, dark mode, @theme config
- [React Router v7 official docs](https://reactrouter.com/start/declarative/installation) — declarative mode setup
- [Dexie.js official docs](https://dexie.org/docs/Tutorial/Design) — schema design, blob handling
- [vite-plugin-pwa docs](https://vite-pwa-org.netlify.app/guide/) — PWA configuration
- [Vite 7 release blog](https://vite.dev/blog/announcing-vite7) — version confirmation, Node.js requirements
- [WebKit storage policy update](https://webkit.org/blog/14403/updates-to-storage-policy/) — iOS storage limits

### Secondary (MEDIUM confidence)
- [Dexie blob storage article](https://medium.com/dexie-js/keep-storing-large-images-just-dont-index-the-binary-data-itself-10b9d9c5c5d7) — blob indexing anti-pattern
- [PWA iOS limitations guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS PWA constraints
- [web.dev PWA manifest](https://web.dev/learn/pwa/web-app-manifest) — manifest best practices
- [web.dev installation prompt](https://web.dev/learn/pwa/installation-prompt) — beforeinstallprompt behavior

### Tertiary (LOW confidence)
- None — all findings verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries locked by project decision, versions verified against npm/official releases
- Architecture: HIGH — patterns verified against official docs for each library
- Pitfalls: HIGH — iOS PWA limitations well-documented by WebKit and multiple credible sources
- Dexie schema: MEDIUM — schema design is sound but exact indexing strategy for 300+ photos/session needs real-world validation

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable stack, no fast-moving dependencies)
