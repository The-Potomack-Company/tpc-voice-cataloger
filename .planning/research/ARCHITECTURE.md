# Architecture Patterns

**Domain:** Adding admin/specialist accounts with session assignment to an existing local-first PWA
**Researched:** 2026-03-17 (updated with concrete stack: Hono + Better Auth + Drizzle + Neon)
**Confidence:** HIGH

## Current Architecture (v1.0 Baseline)

```
User (browser)
  |
  v
React 19 SPA (Vite 7)
  |-- Pages: Sessions, NewSession, SessionDetail, ItemEntry, Settings
  |-- Routing: react-router v7 (BrowserRouter, pathname-based)
  |-- State: Zustand (uiStore, recordingStore) -- UI-only state
  |-- Data: Dexie 4 (IndexedDB) -- ALL persistent data
  |     |-- sessions (++id, mode, status, notes, deletedAt, archivedAt)
  |     |-- houseVisitItems (++id, sessionId, sortOrder, aiStatus)
  |     |-- saleItems (++id, sessionId, receiptNumber, sortOrder, aiStatus)
  |     |-- photos (++id, itemId, blob, thumbnail)
  |     |-- audio (++id, itemId, blob, mimeType)
  |     |-- exportHistory (++id, sessionId, exportedAt)
  |-- Hooks: useLiveQuery (Dexie reactive) -- components auto-update on DB change
  |-- Services: gemini.ts (AI), offlineQueue.ts (retry), export.ts (JSON)
  |
  v (AI calls only)
Cloudflare Worker Proxy --> Gemini API
  |-- CORS: wildcard (to be locked down)
  |-- Auth: API key stored as Worker secret
```

### Key Patterns in Existing Code

1. **Dexie as single source of truth.** All data reads use `useLiveQuery()` from `dexie-react-hooks`, which provides reactive subscriptions. Components never manually refetch.

2. **No server state.** Zero server-side persistence. Everything lives in IndexedDB.

3. **Zustand stores are UI-only.** `uiStore` holds walkthrough state and online status. `recordingStore` holds transient recording state. Neither store holds domain data.

4. **Session lifecycle: active -> completed -> archived.** Plus soft-delete via `deletedAt`.

5. **Export is client-side.** `exportSession()` reads from Dexie, builds JSON, triggers browser download.

6. **Offline queue.** Items with `aiStatus: "queued"` are processed when connectivity returns.

---

## Recommended Architecture for v1.1

### Design Principle: Server-Authoritative for Shared State, Local for Recording

The v1.1 architecture introduces a **server-authoritative model for accounts, session assignment, and workflow state**, while preserving the **local-first pattern for audio recording and AI processing**. Recording and AI remain client-side; only session metadata, assignment, and lifecycle transitions need server coordination.

### System Overview

```
                    +--------------------------------------+
                    |          Vercel Platform              |
                    |                                      |
                    |  +-----------------------------+     |
                    |  |   Static SPA (Vite build)   |     |
                    |  |   /index.html + assets      |     |
                    |  |   (served from CDN)         |     |
                    |  +-----------------------------+     |
                    |                                      |
                    |  +-----------------------------+     |
                    |  |  api/index.ts                |     |
                    |  |  Hono 4.x serverless func   |     |
                    |  |                             |     |
                    |  |  /api/auth/**  (Better Auth) |     |
                    |  |  /api/users    (admin CRUD)  |     |
                    |  |  /api/sessions (assignment)  |     |
                    |  |  /api/sessions/:id/submit   |     |
                    |  |  /api/sessions/:id/return   |     |
                    |  |  /api/sessions/:id/items    |     |
                    |  +-------------|---------------+     |
                    |                |                      |
                    |  +-------------v---------------+     |
                    |  |  Neon Postgres (serverless)  |     |
                    |  |  via Drizzle ORM (neon-http) |     |
                    |  |                             |     |
                    |  |  user, session, account,    |     |
                    |  |  verification (Better Auth) |     |
                    |  |  + session_assignments,      |     |
                    |  |    items, export_history     |     |
                    |  +-----------------------------+     |
                    +--------------------------------------+
                                    |
         +--------------------------+-------------------------+
         |                          |                         |
         v                          v                         v
+-----------------+   +----------------------+   +------------------+
| Admin Browser   |   | Specialist Browser   |   | CF Worker Proxy  |
|                 |   |                      |   | (Gemini AI)      |
| Auth state:     |   | Auth state:          |   |                  |
| Better Auth     |   | Better Auth          |   | (unchanged)      |
| React client    |   | React client         |   +------------------+
|                 |   |                      |
| Server data:    |   | Server data:         |
| fetch + cache   |   | fetch + cache        |
|                 |   |                      |
| Local data:     |   | Local data:          |
| Dexie (audio,   |   | Dexie (audio,        |
| photos, AI q)   |   | photos, AI queue)    |
|                 |   |                      |
| UI state:       |   | UI state:            |
| Zustand         |   | Zustand              |
+-----------------+   +----------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Hono API** (`api/index.ts`) | Single serverless function handling all `/api/*` routes. Auth, session CRUD, assignment, lifecycle transitions, item sync, export. | Neon Postgres via Drizzle ORM |
| **Better Auth** (server) | Authentication, session management, role-based access. Mounted as Hono middleware at `/api/auth/**`. | Drizzle ORM (manages user, session, account tables) |
| **Better Auth** (client) | React hooks for auth state (`useSession()`), sign-in/out methods, admin user management. | Hono API via fetch with credentials |
| **Drizzle ORM** | Type-safe SQL. Schema definition, migrations, queries. | Neon Postgres via `@neondatabase/serverless` (HTTP driver) |
| **Neon Postgres** | Persistent shared state: users, sessions, assignments, items, export history | Accessed only by Hono serverless function |
| **Dexie/IndexedDB** (client) | Audio blobs, photo blobs, AI processing queue (device-local concerns) | Gemini proxy (via offlineQueue) |
| **Zustand** (client) | UI preferences, recording state, online status | Better Auth client (reads user for role checks) |
| **Cloudflare Worker** | Gemini API proxy (unchanged from v1.0) | Gemini API |

### Data Ownership Split

| Data | Owner | Rationale |
|------|-------|-----------|
| Users & credentials | **Server (Neon Postgres via Better Auth)** | Shared, admin-managed. Better Auth manages password hashing, sessions. |
| Auth sessions & tokens | **Server (Better Auth cookies)** | httpOnly cookies. No client-side token storage. |
| Sessions (metadata) | **Server (Neon Postgres)** | Assigned between users, lifecycle is shared |
| Session assignments | **Server (Neon Postgres)** | Admin assigns to specialist |
| Items (catalog fields) | **Server (Neon Postgres)** | Admin reviews specialist work |
| Export history | **Server (Neon Postgres)** | Admin-controlled export |
| Audio blobs | **Client (Dexie)** | Too large for server, only needed during AI processing |
| Photo blobs | **Client (Dexie)** | Keep local for v1.1. Server upload deferred to later milestone. |
| AI processing queue | **Client (Dexie)** | Device-local concern, fires on recording completion |
| Recording state | **Client (Zustand)** | Transient, device-specific |

---

## Data Flow Changes

### Authentication Flow (NEW -- Better Auth)

```
1. User opens app
2. Better Auth client checks for existing session cookie
3. If session cookie exists:
   a. authClient.useSession() returns user + role
   b. If valid: render app with role-aware UI
   c. If invalid/expired: Better Auth handles refresh or redirects to login
4. If no session:
   a. Show LoginPage
   b. User submits username + password
   c. authClient.signIn.username({ username, password })
   d. Better Auth server: validates credentials, sets httpOnly session cookie
   e. useSession() now returns user data
   f. Redirect to home
```

**Key difference from generic JWT pattern:** Better Auth uses httpOnly cookies, not localStorage JWT. The cookie is automatically sent with every request. No manual token management. No XSS vulnerability from token theft.

### Session Creation Flow (CHANGED)

**Before (v1.0):** User fills form -> `createSession()` writes to Dexie -> navigate to session.

**After (v1.1):**

```
Admin fills form (name, mode, notes, assignee)
  |
  v
POST /api/sessions  { name, mode, notes, assignedTo? }
  |-- Hono route handler validates auth (Better Auth middleware)
  |-- Hono route handler checks role === 'admin'
  |-- Drizzle inserts session + assignment in Postgres
  |-- Returns { id, ...session }
  |
  v
Client invalidates session list cache
  |
  v
Navigate to /session/:id
```

### Recording + AI Processing Flow (UNCHANGED locally, NEW sync step)

```
Specialist opens assigned session
  |
  v
Fetch session + items from /api/sessions/:id (with items)
  |
  v
Specialist taps record -> audio saved to Dexie (local, unchanged)
  |
  v
AI processing fires (unchanged: offlineQueue -> CF Worker -> Gemini)
  |
  v
AI results written to Dexie (local) -- aiStatus: "done"
  |
  v  [NEW: sync results to server]
PUT /api/sessions/:id/items/:itemId  { title, description, condition, ... }
  |-- Triggered after aiStatus transitions to "done"
  |-- Pushes structured fields to Postgres
```

### Session Submission Flow (NEW)

```
Specialist clicks "Submit for Review"
  |
  v
POST /api/sessions/:id/submit
  |-- Hono middleware: verify auth, verify user is assignee
  |-- Drizzle: validate all items have aiStatus "done"
  |-- Drizzle: set session.status = "submitted"
  |-- Returns updated session
  |
  v
Admin sees session in "Submitted" section
  |
  v
Admin reviews items, edits inline
  |-- PUT /api/sessions/:id/items/:itemId  { field: value }
  |
  v
Admin either:
  a. "Approve & Export" -> triggers export flow
  b. "Return to Specialist" ->
     POST /api/sessions/:id/return { notes }
     |-- Drizzle: set status = "returned", store returnNotes
     |-- Specialist sees session with admin feedback
```

### Export Flow (CHANGED)

**Before (v1.0):** Client reads from Dexie, builds JSON, triggers download.

**After (v1.1):**

```
Admin clicks "Export"
  |
  v
GET /api/sessions/:id/export
  |-- Hono middleware: verify admin role
  |-- Drizzle reads session + items from Postgres
  |-- Server builds ExportSchema JSON (same format as v1.0)
  |-- Returns JSON
  |
  v
Client triggers browser download of received JSON
  |
  v
Server records in export_history table
```

---

## Server-Side Architecture

### Hono App Structure

All server code lives in `api/index.ts` (single Vercel Function) with supporting modules in `server/`:

```typescript
// api/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from '../server/auth';
import { sessionRoutes } from '../server/routes/sessions';
import { userRoutes } from '../server/routes/users';

const app = new Hono().basePath('/api');

// CORS for cross-origin requests (needed if SPA and API on different subdomains)
app.use('/auth/**', cors({
  origin: process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173',
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

// Better Auth handles all /api/auth/** routes
app.on(['POST', 'GET'], '/auth/**', (c) => auth.handler(c.req.raw));

// Auth middleware for all other routes
app.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', session.user);
  c.set('session', session.session);
  await next();
});

// Mount route groups
app.route('/users', userRoutes);
app.route('/sessions', sessionRoutes);

export default app;
```

### Database Schema (Drizzle ORM)

```typescript
// server/db/schema.ts
import { pgTable, serial, text, timestamp, varchar, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';

// Better Auth manages these tables automatically:
// - user (id, name, email, username, role, ...)
// - session (id, userId, token, expiresAt, ...)
// - account (id, userId, providerId, ...)
// - verification (id, identifier, value, expiresAt, ...)
// Generated by: npx @better-auth/cli generate

// App-specific tables:

export const sessionStatusEnum = pgEnum('session_status', [
  'active', 'submitted', 'returned', 'completed', 'archived'
]);

export const sessionModeEnum = pgEnum('session_mode', ['house', 'sale']);

export const aiStatusEnum = pgEnum('ai_status', [
  'pending', 'processing', 'done', 'failed', 'queued'
]);

export const catalogSessions = pgTable('catalog_sessions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  mode: sessionModeEnum('mode').notNull(),
  status: sessionStatusEnum('status').notNull().default('active'),
  notes: text('notes').default(''),
  createdBy: text('created_by').references(() => user.id).notNull(),
  assignedTo: text('assigned_to').references(() => user.id),
  returnNotes: text('return_notes'),
  deletedAt: timestamp('deleted_at'),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const catalogItems = pgTable('catalog_items', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => catalogSessions.id).notNull(),
  receiptNumber: varchar('receipt_number', { length: 20 }),
  title: text('title'),
  description: text('description'),
  condition: text('condition'),
  estimate: varchar('estimate', { length: 50 }),
  measurements: varchar('measurements', { length: 100 }),
  category: varchar('category', { length: 10 }),
  transcript: text('transcript'),
  aiStatus: aiStatusEnum('ai_status').default('pending'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const catalogExportHistory = pgTable('catalog_export_history', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => catalogSessions.id).notNull(),
  sessionName: varchar('session_name', { length: 200 }).notNull(),
  sessionMode: sessionModeEnum('session_mode').notNull(),
  itemCount: integer('item_count').notNull(),
  exportedBy: text('exported_by').references(() => user.id).notNull(),
  exportedAt: timestamp('exported_at').defaultNow().notNull(),
});
```

**Key schema notes:**
- `user` table is managed by Better Auth (includes `id`, `name`, `username`, `role` fields via admin + username plugins)
- `createdBy` and `assignedTo` reference Better Auth's `user.id` (which is a text/string ID, not integer)
- Unified `catalogItems` table (not separate houseVisitItems/saleItems) -- `receiptNumber` is nullable, present only for sale items
- Photo and audio blobs are NOT in Postgres (remain in Dexie)

### Better Auth Configuration

```typescript
// server/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins/admin';
import { username } from 'better-auth/plugins/username';
import { db } from './db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
    admin({
      // Default roles: 'admin' and 'user'
      // 'user' role = specialist in our domain
    }),
  ],
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // refresh every 24 hours
  },
});
```

**Role mapping note:** Better Auth's admin plugin uses `'admin'` and `'user'` as default roles. In TPC's domain, `'user'` maps to "specialist." The UI labels this as "Specialist" but the database value is `'user'`. This avoids fighting the framework's conventions.

---

## Client-Side Architecture Changes

### Better Auth React Client

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || '',
  plugins: [usernameClient(), adminClient()],
});

// Usage in components:
// const { data: session, isPending } = authClient.useSession();
// session.user.role === 'admin' -> is admin
// session.user.role === 'user' -> is specialist
```

### Route Protection

```typescript
// src/components/AuthGuard.tsx
import { Navigate, Outlet } from 'react-router';
import { authClient } from '../lib/auth-client';

export function AuthGuard() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function AdminGuard() {
  const { data: session } = authClient.useSession();
  if (session?.user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
```

### Updated Route Tree

```typescript
// src/App.tsx (v1.1)
<Routes>
  <Route path="/login" element={<LoginPage />} />

  <Route element={<AuthGuard />}>
    <Route element={<AppLayout />}>
      {/* Shared routes */}
      <Route index element={<SessionsPage />} />
      <Route path="session/:sessionId" element={<SessionDetailPage />} />
      <Route path="session/:sessionId/item/:itemId" element={<ItemEntryPage />} />
      <Route path="settings" element={<SettingsPage />} />

      {/* Admin-only routes */}
      <Route element={<AdminGuard />}>
        <Route path="new" element={<NewSessionPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
    </Route>
  </Route>
</Routes>
```

### Server Data Fetching Pattern

Since Better Auth handles auth state and session management via cookies, and we are NOT adding TanStack Query for this milestone (avoiding unnecessary complexity for 2-5 users), use a simple `apiFetch` wrapper:

```typescript
// src/services/api.ts
const API_BASE = '/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // send auth cookies
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}
```

**Why NOT TanStack Query for v1.1:**
- 2-5 users, no concurrent editing, no complex cache invalidation needs
- Better Auth's `useSession()` already handles the most critical reactive state (auth)
- Simple `useEffect` + `apiFetch` with `useState` is sufficient for session lists
- Can add TanStack Query later if data fetching patterns become complex
- Avoids adding another dependency and learning curve to the v1.1 scope

---

## Patterns to Follow

### Pattern 1: Sync Bridge (AI results from Dexie to Server)

**What:** After AI processing writes results to Dexie (existing flow), push structured fields to the server.

**When:** `aiStatus` transitions to `"done"` in Dexie.

```typescript
// src/services/syncBridge.ts
export async function syncItemToServer(
  localItemId: number,
  serverItemId: number,
  mode: 'house' | 'sale'
): Promise<void> {
  const table = mode === 'house' ? db.houseVisitItems : db.saleItems;
  const item = await table.get(localItemId);
  if (!item || item.aiStatus !== 'done') return;

  await apiFetch(`/sessions/${item.sessionId}/items/${serverItemId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: item.title,
      description: item.description,
      condition: item.condition,
      estimate: item.estimate,
      measurements: item.measurements,
      category: item.category,
      transcript: item.transcript,
      aiStatus: 'done',
    }),
  });
}
```

### Pattern 2: Role-Conditional UI

**What:** Components check user role to show/hide features. Server enforces the real boundary.

```typescript
const { data: session } = authClient.useSession();
const isAdmin = session?.user.role === 'admin';

{isAdmin && <button onClick={handleExport}>Export Session</button>}
{!isAdmin && catalogSession.status === 'active' && (
  <button onClick={handleSubmit}>Submit for Review</button>
)}
```

### Pattern 3: Session Lifecycle State Machine

**What:** Explicit transition validator on the server prevents impossible states.

```typescript
// server/lib/sessionLifecycle.ts
type Status = 'active' | 'submitted' | 'returned' | 'completed' | 'archived';
type Role = 'admin' | 'user';

const TRANSITIONS: Record<string, { to: Status; role: Role }[]> = {
  active:    [{ to: 'submitted', role: 'user' }],
  submitted: [{ to: 'returned', role: 'admin' }, { to: 'completed', role: 'admin' }],
  returned:  [{ to: 'submitted', role: 'user' }],
  completed: [{ to: 'archived', role: 'admin' }],
  archived:  [], // terminal
};

export function canTransition(from: Status, to: Status, role: Role): boolean {
  return TRANSITIONS[from]?.some(t => t.to === to && t.role === role) ?? false;
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Dual Source of Truth for Sessions

**What:** Keeping sessions in both Dexie AND Postgres and syncing bidirectionally.

**Why bad:** ID collisions (Dexie uses auto-increment), conflict resolution nightmares, ambiguous authority.

**Instead:** Server (Postgres) is the single source of truth for session metadata and items. Dexie stores only audio/photo blobs and the AI processing queue.

### Anti-Pattern 2: Migrating v1.0 Dexie Data to Server

**What:** Building a migration to move v1.0 Dexie data to Postgres.

**Why bad:** v1.0 has no user concept. Auto-increment IDs will collide. The effort exceeds the value for 2-5 users.

**Instead:** Start with a clean server database. Export v1.0 data as JSON first (existing export works).

### Anti-Pattern 3: Using Dexie Cloud for Sync

**What:** Adopting Dexie Cloud's commercial sync layer.

**Why bad:** Solves eventual consistency, not server-authoritative workflows. The role-based lifecycle needs server authority.

**Instead:** Hono REST API with Better Auth. Server is authoritative.

### Anti-Pattern 4: Storing Blobs in Postgres

**What:** Uploading audio/photos to Postgres bytea columns.

**Why bad:** Audio files can be several MB. Vercel serverless body limit is 4.5MB. Postgres is not designed for blob storage.

**Instead:** Audio stays in Dexie (discarded after AI processing). Photos stay in Dexie for v1.1. Future: presigned uploads to Vercel Blob or Cloudflare R2.

### Anti-Pattern 5: Adding TanStack Query Prematurely

**What:** Adding a full client caching layer for 2-5 users before the data fetching patterns are established.

**Why bad:** Adds complexity, bundle size, and learning curve. Better Auth already handles the most important reactive state (auth session). Simple fetch + useState handles the rest for this scale.

**Instead:** Use `apiFetch` wrapper + `useState`/`useEffect`. Add TanStack Query only if caching, background refetch, or optimistic updates become genuine needs.

---

## Vercel Deployment Configuration

### vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Order matters: API routes matched first (all go to the single Hono function), everything else falls through to the SPA.

### Environment Variables (Vercel Dashboard)

```
DATABASE_URL=postgresql://...         # Neon Postgres connection string
BETTER_AUTH_SECRET=...                # Random secret for Better Auth session signing
BETTER_AUTH_URL=https://your-app.vercel.app  # Production URL
```

### Local Development

Use `vercel dev` to get the full routing behavior locally (both SPA and API):

```bash
# Install Vercel CLI
npm install -D vercel

# Link project
vercel link

# Set up local env vars
vercel env pull .env.local

# Run dev server
vercel dev
```

Alternatively, use Vite's proxy for local dev if `vercel dev` has issues:

```typescript
// vite.config.ts addition
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

---

## Component Change Matrix

### New Components

| Component | Type | Purpose |
|-----------|------|---------|
| `LoginPage` | Page | Username/password login form using Better Auth client |
| `UsersPage` | Page | Admin: manage specialist accounts via Better Auth admin API |
| `AuthGuard` | Component | Route guard using `authClient.useSession()` |
| `AdminGuard` | Component | Route guard checking `role === 'admin'` |
| `auth-client.ts` | Lib | Better Auth React client configuration |
| `api.ts` | Service | Centralized fetch wrapper with `credentials: 'include'` |
| `syncBridge.ts` | Service | Push AI-processed fields from Dexie to server |
| `api/index.ts` | Server | Hono app entry point (single Vercel Function) |
| `server/auth.ts` | Server | Better Auth configuration |
| `server/db/schema.ts` | Server | Drizzle table definitions |
| `server/db/index.ts` | Server | Drizzle + Neon connection |
| `server/routes/*.ts` | Server | Hono route handlers for sessions, users |

### Modified Components

| Component | What Changes |
|-----------|-------------|
| `App.tsx` | Add `/login` route, wrap routes in `AuthGuard`, add `/users` admin route |
| `AppLayout.tsx` | Show username + role in nav, add logout button, conditionally show admin tabs |
| `SessionsPage` | Fetch sessions from API (not Dexie). Admin sees all; specialist sees assigned. Add "Submitted" section for admin. |
| `NewSessionPage` | Add assignee selector (admin only). POST to API instead of Dexie. |
| `SessionDetailPage` | Fetch from API. Add role-specific buttons: Submit (specialist), Export/Return (admin). Show returnNotes. |
| `ItemEntry.tsx` | Recording still writes to Dexie. After AI completes, `syncBridge` pushes to server. |
| `export.ts` | Admin-only. Fetch export JSON from `/api/sessions/:id/export`. |
| `main.tsx` | Wrap app in BrowserRouter (already done), no new providers needed. |
| `offlineQueue.ts` | Add `syncBridge` call after successful AI processing. |
| `vite.config.ts` | Remove `basicSsl` plugin for production. Add API proxy for local dev. |

### Unchanged Components

| Component | Why Unchanged |
|-----------|--------------|
| `useAudioRecorder.ts` | Recording is entirely local |
| `RecordButton.tsx` | Local recording UI |
| `RecordingIndicator.tsx` | Local recording state |
| `PhotoCapture.tsx` | Local photo capture |
| `gemini.ts` | AI processing pipeline unchanged |
| `geminiSchema.ts` | Schema validation unchanged |
| `receiptNumber.ts` | Validation logic unchanged |
| `importReceipts.ts` | CSV/XLSX parsing unchanged (import flow calls API instead of Dexie) |
| `EditableField.tsx` | Generic UI component, reused for admin editing |

---

## Scalability Considerations

| Concern | At 2-5 users (current) | At 10-20 users | At 100+ users |
|---------|----------------------|----------------|---------------|
| **Database** | Neon free tier (0.5GB) | Neon Launch ($19/mo) | Neon Scale ($69/mo) |
| **Auth** | Better Auth sessions, 7-day expiry | Same | Same (Better Auth scales) |
| **Session load** | Direct queries fine | Add pagination | Full-text search, indexes |
| **Photo storage** | Dexie-only (local) | Vercel Blob (5GB free) | Cloudflare R2 or S3 |
| **API cold starts** | Fluid Compute (~115ms) | Same | Same (auto-scaling) |
| **Real-time updates** | Page refresh / manual reload | Add polling (30s) | SSE or WebSockets |

For 2-5 users, none of the scaling concerns apply. The architecture is intentionally simple.

---

## Sources

- [Hono on Vercel -- zero-config deployment](https://vercel.com/docs/frameworks/backend/hono) (HIGH confidence)
- [Better Auth + Hono integration](https://better-auth.com/docs/integrations/hono) (HIGH confidence)
- [Better Auth admin plugin](https://better-auth.com/docs/plugins/admin) (HIGH confidence)
- [Better Auth username plugin](https://better-auth.com/docs/plugins/username) (HIGH confidence)
- [Drizzle ORM + Neon Postgres](https://orm.drizzle.team/docs/get-started/neon-new) (HIGH confidence)
- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference) (HIGH confidence)
- [Vite on Vercel -- SPA configuration](https://vercel.com/docs/frameworks/frontend/vite) (HIGH confidence)
- [Neon Postgres pricing and free tier](https://neon.com/pricing) (HIGH confidence)

---
*Architecture research for: TPC Speech Cataloger v1.1 -- Accounts & Deploy*
*Researched: 2026-03-17*
