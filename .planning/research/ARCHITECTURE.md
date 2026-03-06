# Architecture Research

**Domain:** Mobile-first PWA with offline audio capture, AI speech parsing, photo capture, session management, and Chrome extension integration
**Researched:** 2026-03-06
**Confidence:** HIGH (core PWA patterns well-established; Chrome extension communication patterns confirmed via official docs)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MOBILE PWA (React + Vite)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Audio       │  │  Camera /    │  │  Session     │  │  Export /   │ │
│  │  Capture UI  │  │  Photo UI    │  │  Manager UI  │  │  Review UI  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │                  │        │
├─────────┴─────────────────┴──────────────────┴──────────────────┴───────┤
│                        React State Layer (Zustand)                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  sessionStore  |  itemStore  |  audioQueue  |  syncStatus        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                        Service Layer                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  AudioService│  │  CameraServ. │  │  AIService   │  │  ExportSvc  │ │
│  │  (MediaRec.) │  │  (getUserM.) │  │  (STT+Parse) │  │  (JSON fmt) │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │                  │        │
├─────────┴─────────────────┴──────────────────┴──────────────────┴───────┤
│                        Persistence Layer (Dexie / IndexedDB)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  sessions    │  │  items       │  │  audio_blobs │  │  sync_queue │ │
│  │  (metadata)  │  │  (fields)    │  │  (raw audio) │  │  (pending)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                        Service Worker (Workbox via vite-plugin-pwa)      │
│  ┌────────────────────────────┐  ┌──────────────────────────────────┐   │
│  │  Asset Cache (cache-first) │  │  Background Sync (sync_queue)    │   │
│  └────────────────────────────┘  └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
┌─────────────────────┐  ┌─────────────────┐  ┌────────────────────────┐
│  OpenAI Whisper API │  │  Gemini/GPT     │  │  TPC Chrome Extension  │
│  (transcription)    │  │  (field parsing)│  │  (batch import)        │
└─────────────────────┘  └─────────────────┘  └────────────────────────┘
                                                         │
                                                         ▼
                                              ┌────────────────────────┐
                                              │  RFC Invaluable        │
                                              │  (rfc.invaluable.com)  │
                                              └────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Audio Capture UI | Record button, tap-to-advance, waveform feedback | AudioService, sessionStore |
| Camera / Photo UI | Take photo per item, preview thumbnail | CameraService, itemStore |
| Session Manager UI | Create / resume sessions, session list | sessionStore, Dexie sessions table |
| Review / Edit UI | Inspect all items, edit fields before export | itemStore, ExportService |
| AudioService | MediaRecorder lifecycle, blob assembly, offline queue | Dexie audio_blobs + sync_queue |
| CameraService | getUserMedia camera stream, ImageCapture, JPEG blob storage | Dexie items table |
| AIService | POST audio blob to Whisper, POST transcript to GPT/Gemini for field parsing | OpenAI, Gemini APIs |
| ExportService | Assemble items into TPC JSON format, trigger chrome.runtime.sendMessage | Chrome extension |
| Zustand stores | In-memory reactive state for UI; initialized from Dexie on boot | Dexie (hydration), UI components |
| Dexie / IndexedDB | Source of truth: sessions, items (structured fields), audio blobs, sync queue | All services |
| Service Worker | Cache static assets, register Background Sync, replay sync_queue on reconnect | Dexie, external APIs |
| TPC Chrome Extension | Receive exported JSON via externally_connectable, drive RFC Invaluable page | RFC Invaluable DOM |

## Recommended Project Structure

```
tpc-app/
├── public/
│   ├── icons/                  # PWA icons (192, 512px)
│   └── manifest.json           # Auto-generated by vite-plugin-pwa
├── src/
│   ├── components/
│   │   ├── audio/
│   │   │   ├── RecordButton.tsx        # Tap-to-start/stop recording
│   │   │   ├── AudioWaveform.tsx       # Visual feedback during recording
│   │   │   └── TranscriptPreview.tsx   # Live transcript display
│   │   ├── camera/
│   │   │   ├── PhotoCapture.tsx        # Camera stream + capture button
│   │   │   └── PhotoThumbnail.tsx      # Per-item photo preview
│   │   ├── session/
│   │   │   ├── SessionList.tsx         # List of saved sessions
│   │   │   ├── SessionCard.tsx         # Resume / delete session
│   │   │   └── ModeSelector.tsx        # House visit vs sale cataloging
│   │   ├── items/
│   │   │   ├── ItemCard.tsx            # Single item review/edit
│   │   │   ├── ItemList.tsx            # All items in session
│   │   │   └── FieldEditor.tsx         # Structured field edit form
│   │   └── export/
│   │       ├── ExportPanel.tsx         # Export trigger, status, instructions
│   │       └── ExtensionStatus.tsx     # Extension detected / not detected
│   ├── services/
│   │   ├── audio.service.ts            # MediaRecorder, blob creation, queue
│   │   ├── camera.service.ts           # getUserMedia, ImageCapture, JPEG blob
│   │   ├── ai.service.ts               # Whisper STT + LLM field parsing
│   │   ├── export.service.ts           # JSON assembly + chrome.runtime message
│   │   └── sync.service.ts             # Background sync queue management
│   ├── store/
│   │   ├── session.store.ts            # Active session state (Zustand)
│   │   ├── items.store.ts              # Items in current session (Zustand)
│   │   └── connectivity.store.ts       # Online/offline status (Zustand)
│   ├── db/
│   │   ├── db.ts                       # Dexie schema and instance
│   │   └── migrations.ts               # Schema version migrations
│   ├── hooks/
│   │   ├── useAudioRecorder.ts         # MediaRecorder lifecycle hook
│   │   ├── useCamera.ts                # Camera stream hook
│   │   ├── useNetworkStatus.ts         # Online/offline detection hook
│   │   └── useSession.ts               # Load/save session persistence hook
│   ├── types/
│   │   ├── session.types.ts            # Session, Item, Field types
│   │   └── export.types.ts             # TPC JSON export schema
│   ├── pages/
│   │   ├── HomePage.tsx                # Session list / create new
│   │   ├── CatalogPage.tsx             # Active recording + item workflow
│   │   └── ReviewPage.tsx              # All items, export trigger
│   ├── sw.ts                           # Custom service worker (injectManifest)
│   ├── App.tsx
│   └── main.tsx
├── extension/                          # Chrome extension source (sibling project)
│   ├── manifest.json
│   ├── background/
│   │   └── service-worker.js           # Handles import message, file parsing
│   └── content/
│       └── importer.js                 # Fills RFC Invaluable fields from JSON
├── vite.config.ts
└── package.json
```

### Structure Rationale

- **services/:** Pure logic separated from React; testable without components. Each service owns one external system boundary.
- **db/:** Dexie schema in one place; migrations are version-gated so schema changes don't corrupt existing IndexedDB data.
- **store/:** Zustand stores are hydrated from Dexie on app start, providing fast reactive UI state without touching IndexedDB on every render.
- **hooks/:** Wrap services + stores into React-friendly interfaces. Components never call services directly — they use hooks.
- **extension/:** Kept in the same monorepo for shared type definitions. Built separately with a different Vite config targeting Chrome extension output.

## Architectural Patterns

### Pattern 1: Offline-First with Optimistic Local Write

**What:** Every user action writes to IndexedDB immediately. The sync_queue table records operations that need to reach the API. The service worker processes the queue when connectivity returns.

**When to use:** All audio blob storage and all item mutations. Any action taken while offline must not be lost.

**Trade-offs:** IndexedDB is the source of truth at all times, which prevents data loss but requires a sync reconciliation step. For this app (2-5 users, no multi-user conflict), last-write-wins is sufficient.

**Example:**
```typescript
// In audio.service.ts — record stops
async function saveAudioBlob(sessionId: string, itemId: string, blob: Blob) {
  // Always write locally first
  await db.audioBlobs.put({ id: itemId, sessionId, blob, createdAt: Date.now() });

  if (navigator.onLine) {
    // Attempt immediate transcription
    await enqueueTranscription(itemId);
  } else {
    // Park in sync queue — service worker will pick up when online
    await db.syncQueue.add({
      type: 'transcribe',
      itemId,
      createdAt: Date.now(),
      retries: 0,
    });
    await registration.sync.register('process-audio-queue');
  }
}
```

### Pattern 2: Service Worker as Queue Processor

**What:** The service worker (`sw.ts`) listens for `sync` events. On wake, it reads `syncQueue` from IndexedDB, processes each pending operation against external APIs, then clears completed entries.

**When to use:** Transcription and AI parsing — both require network. The service worker handles replay so the main tab can be closed during a long house visit.

**Trade-offs:** Background Sync is well-supported on Android Chrome (primary target). iOS Safari has limited Background Sync support — fallback is `window.addEventListener('online', ...)` in the main thread. Both paths read the same queue.

**Example:**
```typescript
// In sw.ts
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'process-audio-queue') {
    event.waitUntil(processAudioQueue());
  }
});

async function processAudioQueue() {
  const pending = await db.syncQueue.where('type').equals('transcribe').toArray();
  for (const item of pending) {
    try {
      const blob = await db.audioBlobs.get(item.itemId);
      const transcript = await callWhisper(blob);
      const fields = await callAIParser(transcript);
      await db.items.update(item.itemId, { ...fields, status: 'parsed' });
      await db.syncQueue.delete(item.id);
    } catch {
      await db.syncQueue.update(item.id, { retries: item.retries + 1 });
    }
  }
}
```

### Pattern 3: Chrome Extension Communication via externally_connectable

**What:** The PWA (running at its hosted URL) sends a JSON payload to the TPC Chrome extension using `chrome.runtime.sendMessage(extensionId, payload)`. The extension receives via `chrome.runtime.onMessageExternal.addListener`. Communication is one-way: PWA initiates, extension confirms receipt.

**When to use:** Export flow — user triggers export from Review page. The extension receives the structured items array and navigates/fills RFC Invaluable pages.

**Trade-offs:** The extension must declare the PWA's origin in `externally_connectable.matches`. Extension ID must be known to the PWA (store as a build-time constant or let user paste it in settings). If extension is not installed, fall back to JSON file download.

**Example:**
```typescript
// In export.service.ts
const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;

export async function sendToExtension(items: CatalogItem[]) {
  if (!window.chrome?.runtime) {
    return downloadAsJSON(items); // fallback
  }
  try {
    await chrome.runtime.sendMessage(EXTENSION_ID, {
      type: 'TPC_IMPORT',
      version: 1,
      items,
    });
  } catch {
    // Extension not installed or wrong ID
    return downloadAsJSON(items);
  }
}
```

## Data Flow

### Flow 1: Audio Capture to Structured Item (Online)

```
User taps Record
    ↓
AudioService.start()
    → MediaRecorder begins, audio chunks accumulate
User taps Stop / Advance
    ↓
AudioService.stop()
    → Blob assembled from chunks
    → db.audioBlobs.put(blob)          [IndexedDB write]
    → db.syncQueue.add(transcribeJob)  [IndexedDB write]
    ↓
AIService.transcribe(blob)
    → POST /audio → OpenAI Whisper
    → Returns transcript string
    ↓
AIService.parseFields(transcript, mode, category)
    → POST transcript → Gemini/GPT with auction catalog prompt
    → Returns { title, description, condition, estimate, category }
    ↓
db.items.update(itemId, fields)        [IndexedDB write]
    ↓
itemStore.hydrate()                    [Zustand update]
    ↓
UI re-renders with structured item
```

### Flow 2: Audio Capture to Structured Item (Offline)

```
User taps Record → Stop (same as above through blob assembly)
    ↓
db.audioBlobs.put(blob)                [IndexedDB write]
db.syncQueue.add({ type: 'transcribe', itemId })
    ↓
registration.sync.register('process-audio-queue')
    ↓
[Device regains connectivity]
    ↓
Service Worker 'sync' event fires
    → Reads sync_queue from IndexedDB
    → Calls Whisper + AI parser per queued item
    → Writes parsed fields to db.items
    → Removes processed entries from sync_queue
    ↓
Main thread detects db.items change
    → itemStore.hydrate()
    → UI shows parsed items
```

### Flow 3: Photo Capture

```
User taps Capture Photo
    ↓
CameraService.capture()
    → ImageCapture.takePhoto() → JPEG Blob
    ↓
db.items.update(itemId, { photoBlob: jpeg })  [IndexedDB write, stored as Blob]
    ↓
CameraService returns ObjectURL for preview
    ↓
PhotoThumbnail renders preview image
```

### Flow 4: Session Save / Resume

```
App launch
    ↓
useSession hook
    → db.sessions.toArray() → loads session list
    ↓
User selects existing session OR creates new
    ↓
db.items.where('sessionId').equals(id).toArray()
    → Hydrates itemStore with all items
    ↓
[User records additional items — writes go to IndexedDB]
    ↓
App close / navigation away
    → No explicit "save" needed — IndexedDB is already the source of truth
```

### Flow 5: Export to Chrome Extension

```
User opens Review page
    → All items rendered from itemStore
    → User edits any fields (writes to db.items)
User taps Export
    ↓
ExportService.sendToExtension(items)
    → Checks chrome.runtime availability
    → chrome.runtime.sendMessage(EXTENSION_ID, { type: 'TPC_IMPORT', items })
    ↓
Extension background service worker receives message
    → Validates payload format
    → Queues items for import workflow
    → Opens RFC Invaluable import page (reports.r3?mm=data)
    → Content script fills form or drives per-item page navigation
    ↓
[Fallback if extension absent]
    → JSON file download via Blob URL
```

### State Management

```
Dexie (IndexedDB) — source of truth
    ↓ (hydrate on mount / on db change)
Zustand stores — reactive in-memory state
    ↓ (subscribe)
React components — UI rendering
    ↓ (user actions via hooks)
Services — business logic
    ↓ (write)
Dexie (IndexedDB) — persistence
```

## Build Order (Phase Dependencies)

This dependency graph informs roadmap phase ordering:

```
Phase 1: Data layer (Dexie schema + types)
    ↓ required by everything
Phase 2: Session management UI + offline persistence
    ↓ required to have a container for items
Phase 3: Audio capture (MediaRecorder) + local blob storage
    ↓ required before AI pipeline
Phase 4: Camera capture + photo storage
    ↓ can be parallel with audio, but depends on Phase 2
Phase 5: AI pipeline (Whisper STT + LLM field parsing)
    ↓ requires audio blobs and item schema from Phases 1-3
Phase 6: Service worker + Background Sync (offline queue replay)
    ↓ requires Phases 3 + 5 to know what to replay
Phase 7: Review / edit UI
    ↓ requires parsed items from Phase 5
Phase 8: Export + Chrome extension integration
    ↓ requires Phase 7 and extension batch import feature
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI Whisper API | POST multipart/form-data from AIService; audio blob + model param | Audio format: WebM/Opus preferred; Safari may produce mp4 — test both |
| Gemini / GPT-4o | POST JSON with transcript + category + system prompt for field extraction | Single API call per item; response must be typed/validated before writing to IndexedDB |
| Chrome Extension (TPC) | chrome.runtime.sendMessage via externally_connectable | Extension must whitelist PWA origin in manifest; PWA must know extension ID |
| RFC Invaluable (rfc.invaluable.com) | Extension drives DOM directly via content script | No RFC API — content script fills #fld1 / #fld2 per item page, or uses import endpoint |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI components <-> Zustand stores | Direct store subscription (useStore hook) | Components never touch Dexie directly |
| Zustand stores <-> Dexie | Services call db.* and then invalidate store; or stores call db.* for hydration | One-directional: Dexie is authoritative |
| Main thread <-> Service Worker | IndexedDB as shared message bus; Background Sync API for triggers | No direct postMessage needed for queue; use BroadcastChannel if UI needs SW notifications |
| PWA <-> Chrome Extension | chrome.runtime.sendMessage (one-shot) | PWA initiates; extension confirms or rejects |
| AudioService <-> Sync queue | AudioService writes to syncQueue table; Service Worker reads | No direct coupling — decoupled via shared IndexedDB table |

## Anti-Patterns

### Anti-Pattern 1: Using Web Speech API as Primary Transcription

**What people do:** Use `window.SpeechRecognition` (browser-native) for live transcription, relying on the browser's built-in STT.

**Why it's wrong:** Web Speech API is online-only (Chrome streams audio to Google servers), has no offline fallback, does not work well for auction terminology (proper nouns, condition terms, estimates), and produces raw text with no structured field extraction. It cannot be queued for offline replay.

**Do this instead:** Use MediaRecorder to capture raw audio blobs locally. Send blobs to Whisper when online. Queue for deferred processing when offline. Whisper can be prompted with domain vocabulary for better accuracy.

### Anti-Pattern 2: Storing Audio Blobs in Zustand (Memory)

**What people do:** Keep the audio Blob in React state or Zustand during and after recording.

**Why it's wrong:** Audio files can be 2-10 MB each. Multiple items in memory degrades performance on mobile and does not survive page reloads or app backgrounding.

**Do this instead:** Write the Blob to IndexedDB immediately when recording stops. Keep only a reference ID (itemId) in Zustand. Load the Blob from IndexedDB only when needed (for upload).

### Anti-Pattern 3: Polling for Connectivity in the Main Thread

**What people do:** setInterval to check navigator.onLine and retry failed API calls from the UI layer.

**Why it's wrong:** Polling wastes battery and CPU on mobile. The app may be in the background or closed. Online/offline detection via polling is unreliable.

**Do this instead:** Use the Background Sync API in the service worker for deferred processing. Register sync events when connectivity returns. In the main thread, listen to `online`/`offline` events only for UI status display (not for triggering API calls).

### Anti-Pattern 4: Tightly Coupling PWA Export to Extension Presence

**What people do:** Make the extension a hard dependency — if not detected, the export button is disabled or the app fails.

**Why it's wrong:** The extension may not be installed on a device, may be outdated, or the user may want to export and import later on another machine.

**Do this instead:** Always provide a JSON file download fallback. The chrome.runtime.sendMessage path is the fast path; the file download is the universal fallback. Both produce identical JSON.

### Anti-Pattern 5: Skipping IndexedDB Schema Versioning

**What people do:** Define a Dexie schema without version numbers, or with a single version.

**Why it's wrong:** Any schema change (adding a field, new table) requires a version bump. Without versioning, existing data in IndexedDB is inaccessible or corrupted when the app updates.

**Do this instead:** Version the schema from day one. Use Dexie's `version(N).stores(...)` pattern with `upgrade()` callbacks for migrations.

## Scaling Considerations

This is a 2-5 user internal tool. Scaling is not a concern. Architecture choices are justified by:

| Concern | At 2-5 users | Notes |
|---------|--------------|-------|
| API cost (Whisper + GPT) | Low — ~50-200 items per session, per session day | Monitor usage; no rate limiting expected |
| IndexedDB storage | Low — audio blobs ~3 MB each, 50 items = ~150 MB; browser quota ~1-2 GB | Monitor with StorageManager API; warn if > 500 MB |
| Extension ID distribution | Manual — give each user the extension ID as a setting | No discovery mechanism needed for 5 people |
| Multi-device sync | Not needed per requirements | If needed later: Dexie Cloud adds sync layer |

## Sources

- [MDN: Offline and background operation in PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [LogRocket: Offline-first frontend apps in 2025 — IndexedDB and SQLite](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Chrome for Developers: Message passing in extensions](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Chrome for Developers: externally_connectable](https://developer.chrome.com/extensions/manifest/externally_connectable)
- [Advanced PWA Playbook: Offline, Push, Background Sync](https://rishikc.com/articles/advanced-pwa-features-offline-push-background-sync/)
- [Dexie.js official documentation](https://dexie.org/)
- [vite-plugin-pwa GitHub](https://github.com/vite-pwa/vite-plugin-pwa)
- [OpenAI Community: MediaRecorder API with Whisper on mobile](https://community.openai.com/t/mediarecorder-api-w-whisper-not-working-on-mobile-browsers/866019)
- [Building offline PWA camera app with React](https://dev.to/ore/building-an-offline-pwa-camera-app-with-react-and-cloudinary-5b9k)
- [Offline-first React apps 2025: PWA + RSC + Service Workers](https://emirbalic.com/building-offline-first-react-apps-in-2025-pwa-rsc-service-workers/)

---
*Architecture research for: Mobile-first PWA with offline audio, AI parsing, photo capture, and Chrome extension integration*
*Researched: 2026-03-06*
