# Stack Research: v1.1 Accounts & Deploy

**Domain:** Authentication, backend API, database, and deployment additions for existing PWA
**Researched:** 2026-03-17
**Confidence:** HIGH

---

## Existing Stack (DO NOT CHANGE)

These are validated in v1.0 and remain as-is:

| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^19.2.0 | UI framework |
| Vite | ^7.3.1 | Build tooling + dev server |
| TypeScript | ~5.9.3 | Type safety |
| Tailwind CSS | ^4.2.1 | Styling |
| Zustand | ^5.0.11 | Client state management |
| Dexie | ^4.3.0 | IndexedDB ORM (local storage) |
| React Router | ^7.13.1 | Client-side routing |
| Zod | ^4.3.6 | Schema validation |
| vite-plugin-pwa | ^1.2.0 | Service worker / PWA manifest |

**Dexie stays as the local data layer.** Sessions, items, photos, and audio continue to live in IndexedDB for offline support. The new backend manages account state, session assignments, and auth only -- it does NOT replace Dexie for recording/cataloging workflows.

---

## Recommended Stack Additions

### Backend API: Hono 4.x

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| hono | ^4.12.8 | Lightweight API framework | Zero-config Vercel deployment. Built on Web Standards (Request/Response). Automatic Fluid Compute (115ms cold starts). Native TypeScript. RPC client gives end-to-end type safety with the React frontend. Vercel treats Hono as a first-class backend framework. |

**Why Hono over alternatives:**
- **vs Express:** Express is not built for serverless. Hono is Web Standards-native, works identically in Cloudflare Workers and Vercel Functions. No cold start penalty from loading Express.
- **vs tRPC:** Hono RPC gives similar type safety but is simpler and lighter. tRPC adds complexity for 2-5 users. Hono also works as a standard REST API.
- **vs Nitro/H3:** Nitro is designed for full-stack frameworks (Nuxt). Hono is simpler for an API-only backend alongside an existing Vite SPA.
- **vs raw Vercel Functions:** Hono gives middleware (CORS, auth), routing, and structured error handling that raw functions lack.

**Architecture:** Single Hono app exported from `api/index.ts`. Vercel auto-detects the `fetch` export and deploys it as a serverless function. All `/api/*` requests route to Hono via `vercel.json` rewrites.

```typescript
// api/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono().basePath('/api');
// ... mount auth, session, user routes
export default app;
```

### Authentication: Better Auth 1.x

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| better-auth | ^1.5.5 | Authentication framework | Framework-agnostic TypeScript auth with first-class Hono integration. Built-in username plugin (no OAuth needed -- matches PROJECT.md "out of scope" for OAuth/SSO). Admin plugin provides role-based access with `admin` and `user` roles out of the box. Session management via secure httpOnly cookies (SameSite=Lax). Drizzle adapter included. CLI generates DB schema. |

**Why Better Auth over alternatives:**
- **vs Auth.js (NextAuth):** Auth.js is Next.js-centric. Better Auth is framework-agnostic and now maintains Auth.js. Has dedicated Hono integration docs and examples.
- **vs Lucia Auth:** Lucia was deprecated in 2024. Better Auth is its spiritual successor with a larger feature set.
- **vs Clerk/Auth0:** Hosted services with per-MAU pricing. Overkill for 2-5 internal users. Better Auth is self-hosted, free, no vendor lock-in.
- **vs custom JWT:** Better Auth handles session tokens, CSRF protection, password hashing, and cookie security correctly. Rolling your own auth is the number one security pitfall.

**Key plugins needed:**

1. **Username plugin** (`better-auth/plugins/username`) -- allows sign-in with username instead of email. PROJECT.md specifies "username/password" not email/password. Adds `username` and `displayUsername` fields to user table.

2. **Admin plugin** (`better-auth/plugins/admin`) -- adds `role` field to user table (defaults to `"user"`). Provides `admin.createUser()` API for admin to create specialist accounts. Built-in role-based access control with customizable permissions.

**Server config:**
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
  plugins: [username(), admin()],
});
```

**Client usage:**
```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || '',
  plugins: [usernameClient(), adminClient()],
});

// Sign in: authClient.signIn.username({ username, password })
// Session hook: authClient.useSession()
// Admin create user: authClient.admin.createUser({ ... })
```

### Database: Neon Postgres (serverless)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @neondatabase/serverless | ^1.0.2 | Postgres driver for serverless | HTTP-based queries (no persistent connections needed in serverless). Free tier: 0.5GB storage, 100 CU-hours/month -- more than sufficient for 2-5 users. Scale-to-zero with 5-minute idle timeout. Vercel Marketplace integration (billing through Vercel dashboard). |

**Why Neon over alternatives:**
- **vs Vercel Postgres:** Vercel Postgres IS Neon now (transitioned Q1 2025). Using Neon directly gives the same service with better docs and control.
- **vs Supabase:** Supabase bundles auth, storage, realtime -- all unnecessary here. Neon is a focused Postgres service without platform coupling.
- **vs PlanetScale:** PlanetScale deprecated its free tier. Neon's free tier is generous for this use case.
- **vs SQLite/Turso:** Postgres is the standard for relational data with roles and foreign key constraints. Better Auth's Drizzle adapter works best with Postgres.

**Data boundary -- what goes where:**

| Postgres (server) | IndexedDB/Dexie (client) |
|---|---|
| User accounts (username, hashed password, role) | Session content (items, transcripts, AI results) |
| Auth sessions/tokens (Better Auth managed) | Audio blobs |
| Session assignments (specialist <-> session mapping) | Photos |
| Session metadata for admin view (name, status, assignee) | Export history |
| | Offline recording queue |

### ORM: Drizzle ORM 0.x

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| drizzle-orm | ^0.45.1 | TypeScript ORM for Postgres | Type-safe SQL queries with zero runtime overhead (compiles to SQL, no query engine binary). Native Neon serverless driver support via `drizzle-orm/neon-http`. Schema-as-code with TypeScript. Migration tooling via drizzle-kit. Better Auth has a dedicated Drizzle adapter that auto-generates auth tables. |

**Why Drizzle over alternatives:**
- **vs Prisma:** Prisma's query engine binary causes 2-5s cold start penalty in serverless and adds ~15MB to bundle size. Drizzle compiles to SQL with no engine binary.
- **vs Kysely:** Similar philosophy, but Drizzle has the Better Auth adapter and better migration tooling (drizzle-kit generate/migrate).
- **vs raw SQL:** Drizzle gives type safety and migration management without sacrificing SQL control.

### Deployment: Vercel

| Technology | Purpose | Why Recommended |
|------------|---------|-----------------|
| Vercel (platform) | Hosting + serverless | Zero-config Vite SPA deployment. Zero-config Hono serverless functions. Preview deployments per PR. Neon Postgres integration via Marketplace. GitHub auto-deploy from main. Free Hobby tier sufficient for internal tool with 2-5 users. |
| vercel (CLI) | Local dev + deploy | `vercel dev` runs both SPA and API locally. `vercel deploy` for manual deploys. |

**Why Vercel over alternatives:**
- **vs Cloudflare Pages:** Cloudflare Pages Functions have a different API. The existing Cloudflare Worker (Gemini proxy) stays separate -- it is not affected by this choice. Vercel has first-class Hono support with Fluid Compute.
- **vs Netlify:** Netlify Functions are AWS Lambda-based with higher cold starts. Vercel's Fluid Compute is faster (115ms vs 500ms+ cold starts).
- **vs Railway/Render:** Always-on servers -- overkill and more expensive for an internal tool with sporadic usage.
- **vs self-hosted:** No DevOps burden. Auto-scaling, auto-SSL, preview deploys out of the box.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | ^0.31.9 | Schema migrations CLI | Dev dependency. `drizzle-kit generate` creates migration SQL, `drizzle-kit migrate` applies it. `drizzle-kit push` for quick dev iteration. |
| dotenv | ^16.x | Environment variables | Dev dependency. Load DATABASE_URL locally. Not needed in Vercel (env vars set in dashboard). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| vercel CLI | Local development | `vercel dev` serves both SPA and API. Use instead of `vite` when testing API routes. |
| drizzle-kit | Database migrations | `npx drizzle-kit push` for dev, `npx drizzle-kit generate && drizzle-kit migrate` for production |
| better-auth CLI | Schema generation | `npx @better-auth/cli generate` creates Drizzle schema for auth tables (user, session, account, verification) |

---

## Project Structure

```
TPC_App/
  api/
    index.ts              # Hono app entry point (Vercel auto-detects)
  server/
    auth.ts               # Better Auth configuration
    db/
      index.ts            # Drizzle + Neon connection
      schema.ts           # Drizzle schema (auth tables + assignments)
    routes/
      sessions.ts         # Session assignment/status API
      users.ts            # User management API (admin only)
  src/                    # Existing React app (unchanged structure)
    db/                   # Dexie (IndexedDB) -- stays as-is
    stores/               # Zustand stores -- add authStore.ts
    lib/
      auth-client.ts      # Better Auth React client
    components/
      AuthGuard.tsx       # Route protection component
    pages/
      Login.tsx           # Login page
    ...
  drizzle/                # Generated migration files
  drizzle.config.ts       # Drizzle Kit configuration
  vercel.json             # Rewrites for SPA + API routing
  .env.local              # DATABASE_URL (gitignored)
  package.json
```

**Critical `vercel.json` configuration:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Order matters: API routes are matched first, everything else falls through to the SPA's `index.html` for React Router to handle.

---

## Installation

```bash
# Backend core
npm install hono better-auth drizzle-orm @neondatabase/serverless

# Dev dependencies
npm install -D drizzle-kit dotenv vercel
```

**Total new dependencies:** 4 production, 3 dev. Minimal footprint.

**Note:** The Hono Vercel adapter (`@hono/vercel`) is likely not needed -- Vercel's zero-config detection recognizes the `fetch` export from a Hono app in `api/index.ts` automatically. Only add it if zero-config fails.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hono | Express | Never for serverless. Express has no Web Standards support, poor cold starts, and large bundle size. |
| Hono | tRPC | If you want subscription/real-time features or complex nested queries with batching. Overkill for 2-5 users. |
| Better Auth | Clerk | If you want zero backend auth code and are OK with per-MAU pricing ($0.02/MAU after free tier) and vendor lock-in. |
| Better Auth | Custom JWT | Never. Auth is security-critical. Rolling your own means handling password hashing, CSRF, session revocation, cookie security manually. |
| Neon Postgres | Supabase | If you also need realtime subscriptions, object storage, or edge functions bundled. Not needed here -- adds unnecessary platform coupling. |
| Neon Postgres | SQLite (Turso) | If you need edge-replicated reads globally. Not needed for 2-5 users in one region. |
| Drizzle | Prisma | If you prefer a more opinionated ORM with Prisma Studio GUI. But Prisma's binary engine causes 2-5s serverless cold starts -- deal-breaker. |
| Vercel | Cloudflare Pages | If you want to consolidate with the existing Cloudflare Worker proxy. But would require rewriting the API layer for CF Workers runtime. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma | Query engine binary causes 2-5s cold starts in serverless. ~15MB bundle size. | Drizzle ORM (zero binary overhead, compiles to SQL) |
| NextAuth / Auth.js | Next.js-centric, requires adapting for Hono. Better Auth now maintains Auth.js anyway. | Better Auth (native Hono integration, dedicated plugins) |
| Firebase Auth | Google vendor lock-in. Requires Firebase SDK. Adds unnecessary complexity and bundle size for 2-5 users. | Better Auth (self-hosted, no vendor dependency) |
| Supabase | Bundles auth, storage, realtime, edge functions -- all unnecessary. Adds platform coupling for features you do not need. | Neon Postgres + Better Auth (focused, composable tools) |
| MongoDB / Mongoose | No relational integrity for role assignments and foreign keys. Postgres is the right tool for structured relational data with constraints. | Neon Postgres + Drizzle ORM |
| JWT-only auth (no server sessions) | JWTs cannot be revoked server-side. If a specialist account is compromised, you cannot invalidate their token until it expires. Session-based auth with secure cookies allows immediate revocation. | Better Auth (httpOnly cookie-based sessions with server-side session store) |
| Replacing Dexie with server DB for content | Audio blobs, photos, and offline recording MUST stay client-side in IndexedDB. Moving to server would break offline support and require uploading large binaries over poor connectivity at house visits. | Keep Dexie for content, Postgres for accounts/assignments only |
| Next.js | Adding a full-stack framework to wrap an existing Vite SPA. Would require rewriting the entire build pipeline, routing, and component structure. Massively disruptive for a feature addition. | Keep Vite SPA + add Hono API in `api/` directory |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| better-auth@^1.5.5 | drizzle-orm@^0.45.1 | Built-in Drizzle adapter via `better-auth/adapters/drizzle`. CLI generates Drizzle-compatible schema. |
| better-auth@^1.5.5 | hono@^4.12.8 | Official Hono integration. Mount with `app.on(["POST","GET"], "/api/auth/**", handler)`. |
| drizzle-orm@^0.45.1 | @neondatabase/serverless@^1.0.2 | Use `drizzle-orm/neon-http` driver for serverless HTTP queries. Fastest for single non-interactive transactions. |
| hono@^4.12.8 | Vercel Functions | Zero-config detection via `fetch` export in `api/` directory. Fluid Compute enabled automatically. |
| vite@^7.3.1 | Vercel | Vite SPA builds are natively supported. Output to `dist/` served as static assets from CDN. |
| react-router@^7.13.1 | Vercel | Requires `vercel.json` SPA rewrite (`/(.*) -> /index.html`) for deep linking. |
| better-auth@^1.5.5 | React 19 | React client via `createAuthClient` from `better-auth/react`. Provides `useSession()` hook. |

---

## Integration Points with Existing Stack

### Zustand: New Auth State Store

Add `authStore.ts` alongside existing `recordingStore.ts` and `uiStore.ts`:

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'specialist';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}
```

Better Auth's React client provides `useSession()` hook for reactive auth state. Zustand syncs this to drive role-based UI decisions (show/hide admin features, restrict export to admin).

### Dexie: Session Ownership Fields

Add `assignedTo` and `submittedAt` fields to the Dexie Session type. This requires a Dexie schema version bump:

```typescript
// db/index.ts -- version 7 addition
db.version(7).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt, assignedTo",
  // ... rest unchanged
});

// db/types.ts -- extend Session interface
export interface Session {
  // ... existing fields
  assignedTo?: string;    // username of assigned specialist
  assignedBy?: string;    // username of admin who assigned
  submittedAt?: Date;     // when specialist submitted for review
}
```

The **server is the source of truth** for assignments. Dexie caches assignment state locally so the specialist can see their assignments while offline.

### React Router: Auth-Protected Routes

Wrap existing routes with an auth guard. Add `/login` route outside the guard:

```typescript
// App.tsx modification
<Routes>
  <Route path="login" element={<LoginPage />} />
  <Route element={<AuthGuard />}>
    <Route element={<AppLayout />}>
      {/* existing routes unchanged */}
    </Route>
  </Route>
</Routes>
```

### Cloudflare Worker: CORS Lockdown

Update the existing `proxy/src/index.ts` to replace wildcard CORS:

```typescript
// Change from:
"Access-Control-Allow-Origin": "*"
// Change to:
"Access-Control-Allow-Origin": "https://your-app.vercel.app"
```

This is a one-line change in the existing proxy, not a new stack addition. Part of DEPLOY-03 requirement.

---

## Sources

- [Hono on Vercel -- official docs](https://vercel.com/docs/frameworks/backend/hono) -- zero-config deployment, Fluid Compute, project structure (HIGH confidence)
- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference) -- `fetch` export, `api/` directory convention (HIGH confidence)
- [Vite on Vercel -- official docs](https://vercel.com/docs/frameworks/frontend/vite) -- SPA rewrite config, vercel.json setup (HIGH confidence)
- [Better Auth Hono Integration](https://better-auth.com/docs/integrations/hono) -- mount handler, CORS config, session middleware (HIGH confidence)
- [Better Auth Username Plugin](https://better-auth.com/docs/plugins/username) -- username-based sign-in, field requirements (HIGH confidence)
- [Better Auth Admin Plugin](https://better-auth.com/docs/plugins/admin) -- role field, createUser API, access control (HIGH confidence)
- [Better Auth Installation](https://better-auth.com/docs/installation) -- setup, Drizzle adapter config (HIGH confidence)
- [Drizzle ORM + Neon setup](https://orm.drizzle.team/docs/get-started/neon-new) -- neon-http driver, schema definition, migration approach (HIGH confidence)
- [Neon Postgres Pricing](https://neon.com/pricing) -- free tier: 0.5GB storage, 100 CU-hours/month (HIGH confidence)
- [hono on npm](https://www.npmjs.com/package/hono) -- v4.12.8, last published 2026-03-14 (HIGH confidence)
- [better-auth on npm](https://www.npmjs.com/package/better-auth) -- v1.5.5, last published 2026-03-13 (HIGH confidence)
- [drizzle-orm on npm](https://www.npmjs.com/package/drizzle-orm) -- v0.45.1 (HIGH confidence)
- [@neondatabase/serverless on npm](https://www.npmjs.com/package/@neondatabase/serverless) -- v1.0.2 (HIGH confidence)
- [drizzle-kit on npm](https://www.npmjs.com/package/drizzle-kit) -- v0.31.9 (HIGH confidence)

---

*Stack research for: TPC Speech Cataloger v1.1 -- Accounts & Deploy*
*Researched: 2026-03-17*
