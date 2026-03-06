# Stack Research

**Domain:** Mobile-first PWA — Speech-to-text auction cataloging with offline support and AI parsing
**Researched:** 2026-03-06
**Confidence:** HIGH (core choices), MEDIUM (version pins — verify at scaffold time)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI framework | Dominant PWA ecosystem; best tooling for hooks-heavy audio/recording state; most production examples for MediaRecorder + IndexedDB patterns. Vue is a viable alternative but React has the edge in available community solutions for the specific combination of audio capture + offline queue. |
| TypeScript | 5.x | Type safety | Mandatory. The JSON export format must match the extension's schema exactly — types enforce this at compile time. Eliminates an entire class of integration bugs. |
| Vite | 7.x | Build tool | Current standard for React PWAs post-CRA death. vite-plugin-pwa integrates directly. Fastest HMR for mobile iteration. |
| vite-plugin-pwa | 1.x | Service worker + manifest | Zero-config PWA: auto-generates service worker precache, web app manifest, install prompt handling. Wraps Workbox — the industry standard for service worker caching strategies. Use `generateSW` strategy for simplicity. |
| Tailwind CSS | 4.x | Styling | Released stable January 2025. Fastest mobile-first CSS authoring. Critical for rapid iteration on touch targets, swipe controls, large tap areas. 5x faster full builds than v3. |
| Zustand | 5.x | Client state | Minimal, hook-first, no boilerplate. `persist` middleware serializes session state to localStorage for free. Correct fit for 2-5 user internal tool — no need for Redux complexity. |
| Dexie.js | 4.x | IndexedDB wrapper | The standard IndexedDB abstraction for PWAs. Stores: (1) audio blobs queued for transcription when offline, (2) active catalog sessions, (3) completed entries pending export. Raw IndexedDB API is painful to use; Dexie makes it Promises-based. |
| `@google/genai` | 1.x | Gemini AI SDK | **Use this, not `@google/generative-ai`** — the old package was deprecated; support ends November 2025. The new unified SDK reached GA in May 2025. Handles both audio transcription and structured field parsing in a single Gemini call. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `workbox-background-sync` | 7.x | Background Sync API wrapper | Retries queued API calls (transcription, parsing) when connectivity returns. Note: only works in Chromium browsers — Safari does not support Background Sync. Always implement the immediate-retry fallback. |
| `react-hook-form` | 7.x | Form state | Review/edit screen where transcribed entries can be corrected before export. Minimal re-renders matter on mobile. |
| `idb-keyval` | 6.x | Simple key-value IndexedDB store | For simple key-value persistence (current session ID, user preferences) where full Dexie schema is overkill. |
| `react-router-dom` | 7.x | Client-side routing | House Visit mode vs Sale Cataloging mode are distinct routes. Hash-based routing recommended for PWA to avoid 404 issues on refresh. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@vitejs/plugin-react` | React fast refresh in Vite | Use the Babel-based version (not SWC) unless build performance becomes a concern — Babel has better ecosystem compatibility. |
| `typescript` | Type checking | Configure `strict: true`. Define shared types for the JSON export schema in a `types/` directory imported by both the PWA and the extension. |
| `vitest` | Unit testing | Vite-native test runner. Test the AI prompt templates and JSON schema transformation functions — these are the fragile parts. |
| `@playwright/test` | E2E testing | For the Chrome extension batch import feature. Playwright has built-in extension testing support. |
| `eslint` + `prettier` | Code quality | Standard config. `eslint-plugin-react-hooks` to catch incorrect hook usage in recording state machines. |

---

## Installation

```bash
# Scaffold
npm create vite@latest tpc-cataloger -- --template react-ts
cd tpc-cataloger

# Core PWA
npm install -D vite-plugin-pwa

# State + storage
npm install zustand dexie idb-keyval

# Routing + forms
npm install react-router-dom react-hook-form

# AI
npm install @google/genai

# Styling
npm install -D tailwindcss@4 @tailwindcss/vite

# Background sync
npm install workbox-background-sync

# Dev
npm install -D vitest @playwright/test eslint prettier eslint-plugin-react-hooks
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React 19 + Vite 7 | Next.js 15 | If SSR or server-side AI processing were needed. Not applicable here — this is a client-only offline-first tool. Next.js adds server complexity with no benefit. |
| React | Vue 3 + Nuxt | If the team had existing Vue expertise. Vue's offline-first PWA story (vite-plugin-pwa works for Vue too) is equally strong. Decision is team familiarity, not technical. |
| `@google/genai` (Gemini) | OpenAI Whisper + GPT-4o | If the existing Chrome extension used OpenAI. The extension already uses Gemini — matching the AI provider eliminates prompt divergence and keeps billing in one place. |
| Dexie.js | sql.js (SQLite in browser) | For complex relational queries. Auction catalog entries are document-like, not relational. Dexie's document model fits without the 500KB WASM overhead of sql.js. |
| MediaRecorder API | Web Speech API | **Do not use Web Speech API for this project** (see "What NOT to Use" below). MediaRecorder is the correct audio capture primitive. |
| Zustand | Jotai | Either works. Zustand's `persist` middleware is better documented for offline PWA use cases. |
| Tailwind CSS v4 | Tailwind CSS v3 | If existing project used v3. Greenfield — use v4 for the build performance and new CSS-based config. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Web Speech API (`SpeechRecognition`) | **Completely broken in iOS Safari when running as a PWA** (installed to home screen). Safari Mobile WebView triggers an immediate error and never requests microphone permission. Chrome on iOS also does not support it because iOS forces all browsers to use WebKit. This is fatal for a tool used on-site at house visits. | `MediaRecorder API` to capture audio, then send to Gemini for transcription. |
| `@google/generative-ai` | Deprecated. Official support ends November 30, 2025. The package has not been updated in 10+ months. Using it means you'll be rewriting the AI integration layer within months of shipping. | `@google/genai` (the new unified SDK, GA since May 2025). |
| Redux / Redux Toolkit | Overkill for a 2-5 person internal tool with simple session state. The boilerplate cost (actions, reducers, selectors) adds weeks of setup for zero benefit at this scale. | Zustand with persist middleware. |
| Create React App (CRA) | Dead project, no longer maintained by Meta. Last release was 2022. | Vite 7 with `@vitejs/plugin-react`. |
| Background Sync as the only retry mechanism | Safari does not implement Background Sync. If a house visit uses an iPhone (likely), queued recordings will never sync automatically. | Background Sync for Chromium + immediate retry with `navigator.onLine` event listener as the universal fallback. |
| Storing audio blobs in localStorage | localStorage has a 5MB limit. A 60-second voice recording at AAC quality is ~500KB–1MB. Multiple recordings will hit the limit immediately. | IndexedDB via Dexie.js — designed for binary blob storage with no practical size limit. |
| Gemini Live API (streaming) | Adds WebSocket complexity and real-time billing for no user-facing benefit. Auctioneers record a complete utterance, then tap to advance — they don't need real-time transcription feedback. | Standard `generateContent` with inline audio base64 after recording stops. |

---

## Stack Patterns by Variant

**iOS audio format handling:**
- Always call `MediaRecorder.isTypeSupported()` before recording to detect supported codec
- iOS Safari produces AAC (`.m4a`); Android Chrome produces WebM/Opus
- Gemini accepts both — pass the detected MIME type in the API call
- Do NOT assume WebM/Opus everywhere or iOS transcription silently fails

**Offline queue flow:**
- Record audio → store blob in Dexie `pendingAudio` table with unique ID
- When `navigator.onLine` becomes true → dequeue, call Gemini, store result
- If Gemini call fails → mark entry as `failed`, show retry UI
- Do NOT use service worker fetch interception for the AI API calls — the audio payload is too large for reliable service worker handling

**Extension integration (JSON export):**
- Define a shared TypeScript interface `CatalogEntry` that matches the extension's expected import format
- Export produces a `.json` file downloaded to device
- User opens Chrome on desktop, opens extension, uploads the file for batch import
- Do NOT attempt `chrome.runtime.sendMessage` from the mobile PWA — it requires the extension to be installed in the same browser, which will not be the case (mobile browser vs desktop Chrome)

**Service worker caching strategy:**
- Use `generateSW` in vite-plugin-pwa with `NetworkFirst` for API routes (none, this app has no backend)
- Use `CacheFirst` for static assets (app shell, fonts, icons)
- Exclude Gemini API calls from service worker interception — they must go direct

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `vite-plugin-pwa@1.x` | Vite 5+ / Vite 7 | Works. Plugin requires Vite 5 minimum; Vite 7 is the current latest. |
| `@google/genai@1.x` | Node 18+ | Uses modern fetch API. Works in browser environments directly. |
| `react@19.x` | `react-router-dom@7.x` | Router v7 was built for React 19 concurrent features. |
| `tailwindcss@4.x` | `@tailwindcss/vite` plugin | v4 requires its own Vite plugin — do NOT use `tailwindcss` as a PostCSS plugin (v3 approach). The `@tailwindcss/vite` plugin replaces it. |
| `dexie@4.x` | All modern browsers | IndexedDB is universally supported. Dexie 4 drops IE11 support. |
| `workbox-background-sync@7.x` | Chrome/Edge only | Firefox and Safari do not implement the Background Sync API. Must pair with fallback. |

---

## Sources

- MDN Web Docs — Web Speech API: [https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — iOS PWA limitation confirmed (HIGH confidence)
- caniuse.com — Speech Recognition API: [https://caniuse.com/speech-recognition](https://caniuse.com/speech-recognition) — Browser support table (HIGH confidence)
- buildwithmatija.com — iPhone Safari MediaRecorder + transcription guide (2025): confirms format compatibility requirements (MEDIUM confidence)
- Google AI Developers — Gemini API Libraries: [https://ai.google.dev/gemini-api/docs/libraries](https://ai.google.dev/gemini-api/docs/libraries) — `@google/genai` as the current SDK (HIGH confidence)
- GitHub — deprecated-generative-ai-js: [https://github.com/google-gemini/deprecated-generative-ai-js](https://github.com/google-gemini/deprecated-generative-ai-js) — deprecation confirmed (HIGH confidence)
- Google AI Developers — Audio understanding: [https://ai.google.dev/gemini-api/docs/audio](https://ai.google.dev/gemini-api/docs/audio) — supported audio formats and inline base64 approach (HIGH confidence)
- Gemini API Pricing: [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) — audio costs 7x text tokens (MEDIUM confidence)
- vite-pwa-org.netlify.app — Vite Plugin PWA docs: [https://vite-pwa-org.netlify.app/](https://vite-pwa-org.netlify.app/) — generateSW strategy (HIGH confidence)
- LogRocket — Offline-first frontend apps 2025: [https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — IndexedDB vs SQLite comparison (MEDIUM confidence)
- npm — dexie: [https://www.npmjs.com/package/dexie](https://www.npmjs.com/package/dexie) — version 4.3.0 confirmed (HIGH confidence)
- npm — vite-plugin-pwa: [https://www.npmjs.com/package/vite-plugin-pwa](https://www.npmjs.com/package/vite-plugin-pwa) — version 1.1.0 confirmed (HIGH confidence)
- Chrome Developers — Message passing: [https://developer.chrome.com/docs/extensions/develop/concepts/messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — extension communication patterns (HIGH confidence)
- WebSearch — Background Sync Safari status 2025: confirmed Safari does not implement Background Sync (MEDIUM confidence, multiple sources agree)

---

*Stack research for: TPC Speech Cataloger — Mobile-first PWA, auction cataloging*
*Researched: 2026-03-06*
