# Pitfalls Research

**Domain:** Mobile PWA speech-to-text auction cataloging with offline support and Chrome extension integration
**Researched:** 2026-03-06
**Confidence:** HIGH (core platform limitations), MEDIUM (AI parsing patterns), HIGH (Chrome extension MV3)

## Critical Pitfalls

### Pitfall 1: Web Speech API Cannot Record Offline — It Requires a Server Round-Trip

**What goes wrong:**
Developers assume the Web Speech API (`SpeechRecognition`) provides in-browser transcription. It does not. On Chrome (Android and desktop), every call streams audio to Google's servers for processing. When the device goes offline, `SpeechRecognition` silently fails or fires `onerror` with `network`. There is no fallback. The app cannot transcribe at all until connectivity returns.

**Why it happens:**
The Web Speech API hides its server dependency behind a clean browser API. Developers testing on WiFi never see the failure. The API looks local but is not.

**How to avoid:**
Use `MediaRecorder` to capture raw audio into the browser. Store audio blobs in IndexedDB tagged with a `status: pending_transcription` flag. When connectivity is confirmed, POST the audio file to Whisper (OpenAI) or Gemini for transcription. Never use `SpeechRecognition` as the primary capture path. `SpeechRecognition` may be used as a UX enhancement (live interim transcript display) but must never be the only path to text.

**Warning signs:**
- App works on WiFi in the office but fails silently at house visits
- No audio queued during offline sessions — means `MediaRecorder` path was never built
- Error: `recognition.onerror` fires with `network` code immediately on poor signal

**Phase to address:**
Phase 1 (Core audio capture) — establish `MediaRecorder` + IndexedDB pipeline before building any transcription UI.

---

### Pitfall 2: iOS Safari PWA Re-Requests Microphone Permission on Every Hash Change

**What goes wrong:**
On iOS, microphone permissions granted to a PWA are not persistent across route changes when using hash-based routing (`#/item/1` → `#/item/2`). Safari fires a new permission prompt mid-session. There is also a known WebKit bug (`bug 215884`) where the standalone PWA mode revokes camera/microphone access on hash navigation. Auctioneers tapping through 30 items at a house visit get permission dialogs repeatedly.

**Why it happens:**
iOS Safari treats each hash navigation as a new document context for media permissions. This is a WebKit design choice, not a bug developers can fix in app code alone.

**How to avoid:**
Use pathname-based routing only (`/items/1`, `/items/2`) — never hash routing. Keep the microphone stream alive across route transitions by holding a reference to the `MediaStream` object at the app root level (do not re-request via `getUserMedia()` on each route). On iOS, require the user to tap once to initialize audio before any recording session starts (audio context autoplay policy requires a user gesture). Test specifically on iOS Safari in standalone (home screen) mode, not in the browser.

**Warning signs:**
- Permission dialogs appearing mid-session on iOS
- Using `window.location.hash` or React Router's hash mode
- `getUserMedia()` called inside a component that re-mounts on navigation

**Phase to address:**
Phase 1 (Core audio capture) — establish routing strategy and stream lifecycle management before building the recording UI.

---

### Pitfall 3: Audio Blobs Accumulate Without Eviction — Mobile Storage Gets Exhausted

**What goes wrong:**
Audio blobs stored in IndexedDB for offline queuing are large (a 60-second recording at reasonable quality is 500KB–2MB). Without explicit cleanup after successful transcription, blobs pile up. On mobile devices, browser storage quotas can be 50–150MB for PWAs. Safari applies an additional 7-day eviction policy for browser storage when the PWA is not used — data loss is silent. If the user does a 3-hour house visit generating 100 items, storage exhaustion causes new recordings to silently fail to save.

**Why it happens:**
Developers build the "store blob" path and forget to build the "delete blob after success" path. The happy path (online at all times) is tested; the storage-under-pressure path is not.

**How to avoid:**
After each item is confirmed transcribed and parsed, immediately delete the raw audio blob from IndexedDB (keep only the text). Implement a maximum blob size check before recording starts — warn the user if storage is below a threshold. Use the Storage API (`navigator.storage.estimate()`) to check remaining quota. For items that fail transcription after 3 retries, archive blob metadata and alert the user; don't keep the blob indefinitely. Request persistent storage (`navigator.storage.persist()`) on first launch to opt out of Safari's 7-day eviction.

**Warning signs:**
- No cleanup logic after successful API response
- `QuotaExceededError` in production logs
- Sessions saved offline at house visits but never appear when back online

**Phase to address:**
Phase 2 (Offline queue and sync) — storage lifecycle management is a first-class requirement, not an afterthought.

---

### Pitfall 4: AI Parsing Hallucinating Fields Not Present in the Audio

**What goes wrong:**
When prompting an LLM (Gemini, GPT-4) to extract structured fields (title, description, condition, estimate, category) from a speech transcription, the model confidently fills fields with plausible-sounding but fabricated values. Example: the auctioneer says "nice oak table, good condition" — the AI extracts `estimate: $800-$1200` despite no price being mentioned. This propagates into the catalog, requiring manual review to catch.

**Why it happens:**
LLMs are trained to produce complete, plausible outputs. When a schema field is required but absent from the input, the model infers or invents. JSON schema enforcement (structured outputs) fixes format but does not prevent hallucinated content within a field.

**How to avoid:**
Use `null` or explicit absence as a valid schema value for every non-mandatory field. Include in the system prompt: "If a field is not mentioned in the audio, return null — do not infer or estimate." Use structured outputs (OpenAI `response_format: json_schema` or Gemini equivalent) so field presence is enforced, but validate content by checking for implausible patterns (estimate present but no price words in transcript). Require auctioneers to review all parsed fields before export — never auto-export without a review step. Log transcription input alongside parsed output for auditing.

**Warning signs:**
- Estimate fields populated when no price was dictated
- Category assigned with high confidence when audio was ambiguous
- Review UI is skippable or auto-advances after 3 seconds

**Phase to address:**
Phase 3 (AI parsing) — include explicit null-handling in the initial prompt design and validate against the raw transcription before returning to UI.

---

### Pitfall 5: Chrome Extension DOM Selectors Break When RFC Invaluable Updates Its HTML

**What goes wrong:**
The TPC extension fills fields by targeting `#fld1` and `#fld2` on RFC Invaluable item pages. If RFC's dev team renames, restructures, or moves those selectors during a site update, the extension silently writes nothing — or worse, writes into the wrong field. The batch import feature is even more fragile: it targets the inventory import page (`reports.r3?mm=data`) which has no documented API contract.

**Why it happens:**
Scraping and DOM manipulation are inherently fragile against third-party site changes. ID-based selectors seem stable but aren't guaranteed. The extension has no test harness against the live site.

**How to avoid:**
Add element existence checks and write verification: after setting a field's value, re-read it to confirm the value was accepted. Fire both the native input event and React's synthetic event (`dispatchEvent(new Event('input', { bubbles: true }))`) since RFC may use a JS framework that ignores direct `.value` assignment. Wrap all DOM operations in try/catch. Log all selector failures to the extension's background service worker for observability. For the batch import page, record the exact HTTP request the manual import makes (via DevTools Network tab) and replicate it as a fetch rather than relying on DOM manipulation — network-level API is more stable than UI scraping.

**Warning signs:**
- No verification step after writing to `#fld1`/`#fld2`
- Extension silently completes without user-visible confirmation
- No logging in the content script for field write failures

**Phase to address:**
Phase 4 (Chrome extension batch import) — build defensive DOM writing with verification before the batch import workflow; do not assume selectors are stable.

---

### Pitfall 6: Service Worker Background Sync Is Not Available on iOS — Queue Stays Stuck

**What goes wrong:**
The Background Synchronization API (`SyncManager`) is only available in Chromium-based browsers. Firefox keeps it disabled. Safari/iOS does not implement it at all (as of 2026). If the offline queue relies on Background Sync to trigger processing when connectivity returns, the queue will never drain on iOS unless the user opens the app manually.

**Why it happens:**
Background Sync is documented as a progressive enhancement, but it's easy to build the entire offline-to-online sync path around it and only discover the iOS gap during QA.

**How to avoid:**
Treat Background Sync as a Chromium-only enhancement only. Build the primary sync trigger as an `online` event listener inside the app itself: `window.addEventListener('online', processQueue)`. This fires when the foreground app detects connectivity — it works on iOS, Android, and all browsers. Background Sync in the service worker can be registered as an additional layer for Android Chrome only. Test on iOS Safari in standalone mode before assuming the queue drains automatically.

**Warning signs:**
- Sync logic lives only inside `self.addEventListener('sync', ...)` in the service worker
- No `window.addEventListener('online', ...)` handler in the app shell
- Queue processing only tested on Android Chrome

**Phase to address:**
Phase 2 (Offline queue and sync) — use the `online` event as the primary trigger; Background Sync is a secondary enhancement.

---

### Pitfall 7: Audio Format Mismatch Between MediaRecorder Output and Transcription API Input

**What goes wrong:**
`MediaRecorder` on iOS/Safari produces `audio/mp4` (AAC). On Android Chrome it produces `audio/webm;codecs=opus`. If the transcription service (Whisper, Gemini) or the server receiving the audio expects a specific format and the code hardcodes `audio/webm`, iOS recordings fail server-side with encoding errors — often silently (no error surfaced to the user).

**Why it happens:**
Developers test on one platform. The mimeType difference is not obvious at the JS layer. The blob is "an audio file" regardless of format from the app's perspective.

**How to avoid:**
Always use `MediaRecorder.isTypeSupported()` to detect the best available format per device and store the mimeType alongside the blob in IndexedDB. Pass the correct `Content-Type` header when uploading to the transcription API. If the API only accepts one format, transcode in the browser using the Web Audio API or AudioContext before upload — or use a server-side conversion step. Test recording → upload → transcription on both iOS Safari and Android Chrome before considering the audio pipeline complete.

**Warning signs:**
- `mimeType` hardcoded as `'audio/webm'` anywhere in the codebase
- No `MediaRecorder.isTypeSupported()` check
- Transcription tested only on desktop Chrome

**Phase to address:**
Phase 1 (Core audio capture) — format detection is part of the initial MediaRecorder setup, not a later optimization.

---

### Pitfall 8: JSON Export Format Drift Between PWA and Chrome Extension

**What goes wrong:**
The PWA generates JSON export files. The Chrome extension imports them. If the schema drifts — a field renamed, a type changed, a required field added — the extension silently skips items or throws a runtime error. With two separate codebases, this is guaranteed to happen without a shared contract.

**Why it happens:**
The export format is treated as an implementation detail rather than a versioned API. Schema is defined in one place (the PWA), the consumer is in another (extension), and there's no validation at the boundary.

**How to avoid:**
Define the exchange format in a single shared schema file (JSON Schema or TypeScript types) that both codebases import from. Version the format (`"version": 1` in every exported file). Add format validation in the extension's import handler — reject or warn on unexpected versions. Any schema change requires bumping the version and updating the extension import handler simultaneously.

**Warning signs:**
- No schema version field in the export JSON
- PWA and extension define the data types independently
- No import validation in the extension before processing

**Phase to address:**
Phase 1 (project setup) — define and document the exchange schema before writing export or import code.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use Web Speech API for live transcription only, no offline fallback | Faster Phase 1 ship | House visit sessions produce no data on poor signal | Never — offline recording is the core requirement |
| Hardcode RFC DOM selectors without verification | Simpler extension code | Silent data loss when RFC updates its HTML | Never — always verify writes |
| Skip audio format detection, assume webm | Simpler upload path | iOS recordings silently fail transcription | Never — both platforms must work |
| No schema version in export JSON | Slightly simpler export | Cannot safely evolve format without breaking extension | Acceptable only in pre-alpha; add before first real use |
| Store full audio blobs indefinitely in IndexedDB | Simpler to build | Storage exhaustion on long sessions | Never — implement cleanup immediately after transcription |
| Skip the review step before export | Faster workflow for auctioneers | Hallucinated fields enter the catalog silently | Never — review is the safety gate |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Whisper / Gemini STT API | Sending raw blob without mimeType content-type header | Store mimeType with blob; pass as `Content-Type` on upload |
| Gemini structured output parsing | Relying on JSON schema to prevent hallucination of field values | Schema enforces format only; validate content against raw transcript |
| RFC Invaluable DOM (`#fld1`, `#fld2`) | Direct `.value =` assignment without triggering input events | Fire `new Event('input', { bubbles: true })` after writing; verify value was accepted |
| RFC inventory import page (`reports.r3?mm=data`) | DOM manipulation of file upload form | Capture the exact HTTP multipart request via DevTools; replicate as fetch call |
| Chrome extension ↔ PWA data handoff | Clipboard or URL-param hacks for data transfer | Use file download/upload (JSON file); extension imports from Downloads or file picker |
| IndexedDB across PWA installs | Assuming data persists across app reinstall | PWA data is wiped on uninstall; add export-to-file as backup for critical session data |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Storing audio blobs in React state or component memory | App memory grows with each recorded item; eventual crash | Store blobs only in IndexedDB; keep only metadata in state | After 5-10 recorded items on low-RAM devices |
| Re-requesting `getUserMedia()` on each item tap | Microphone permissions re-prompted on iOS; latency spike | Hold a single `MediaStream` reference at app root; reuse across items | Every item tap on iOS |
| Sending full audio file size without compression | Slow upload on poor signal; Whisper has 25MB file limit | Downsample to 16kHz mono before upload; use WebM/Opus at low bitrate | Files over 5 minutes or poor 4G connections |
| Processing entire offline queue sequentially without concurrency limit | API rate limits hit; one failure blocks entire queue | Process 1-2 items concurrently with exponential backoff; mark individual items failed, not entire queue | After 10+ queued offline items |
| Loading all session data into memory on app open | App startup slow on tablet with large session history | Paginate session list; lazy-load item detail only when viewed | Sessions with 50+ items |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing AI API key in PWA frontend bundle | Key exposed in browser DevTools source; billed for unauthorized usage | Proxy all AI API calls through a backend (even a simple serverless function); never put keys in client code |
| No rate limiting on transcription proxy endpoint | Unlimited AI costs if endpoint is discovered | Add simple auth token (shared secret header) to proxy; validate on every request |
| Accepting arbitrary JSON from extension file import without validation | Malformed import crashes extension or writes garbage to RFC | Validate import JSON against schema before processing; reject unknown versions |
| Logging full audio transcriptions to browser console | Sensitive item descriptions exposed in shared-device DevTools | Remove verbose transcription logging before production; use structured log levels |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback that offline recording is active and queued | Auctioneer unsure if item was saved; re-records items; duplicates | Show persistent "Offline — recording saved locally" banner; display queue count |
| Review screen auto-advances or is easy to skip | Hallucinated fields enter catalog; errors found only after RFC import | Review is mandatory for all items; no auto-advance; require explicit "Approve" tap per item |
| Receipt number entry for sale mode as free-text only | Typos in format `XXXXX-N` cause import failures | Validate receipt format (`/^\d{5}-\d+$/`) at entry time with inline error |
| AI parsing result shown as final without showing raw transcript | Auctioneer cannot catch where parsing went wrong | Show raw transcript alongside parsed fields in review screen |
| Tap-to-advance button too small for field use | Missed taps while holding phone and moving through a house | Minimum 64px tap target; consider large "NEXT ITEM" bottom-sheet button with haptic feedback |
| No session recovery prompt on app reopen | Power loss or crash loses in-progress session | On app open, detect incomplete session in IndexedDB; prompt "Resume previous session?" |

---

## "Looks Done But Isn't" Checklist

- [ ] **Offline recording:** Verified on Airplane Mode — items actually appear in queue, not silently dropped
- [ ] **iOS audio:** Tested on real iPhone in Safari standalone mode (home screen), not just desktop Chrome
- [ ] **Permission flow:** Microphone not re-prompted between items on iOS during a session
- [ ] **Transcription:** Tested with actual auction speech ("Victorian mahogany bureau bookcase, good condition, slight foxing to interior shelves")
- [ ] **AI parsing nulls:** Field absent in speech → field is `null` in output, not a hallucinated value
- [ ] **Storage cleanup:** Audio blobs deleted from IndexedDB after successful transcription — not retained
- [ ] **Extension selector verification:** After writing `#fld1`, value is confirmed via re-read before proceeding
- [ ] **Format mimeType:** Recorded mimeType stored alongside blob and sent as Content-Type header on upload
- [ ] **Export schema versioned:** Export JSON contains `"version"` field; extension rejects unknown versions
- [ ] **Queue drains on iOS:** `window.addEventListener('online', ...)` triggers processing — not only Background Sync
- [ ] **Storage quota checked:** `navigator.storage.estimate()` runs on session start; user warned if low
- [ ] **Persistent storage requested:** `navigator.storage.persist()` called on first install to prevent Safari eviction

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AI hallucinated fields shipped to catalog | MEDIUM | Add review screen with raw transcript display; re-run parse on flagged items; manual correction in RFC |
| Audio blobs lost to Safari 7-day eviction | HIGH | Data is unrecoverable if audio-only; mitigate by syncing text data to server more aggressively; nothing replaces lost blobs |
| Extension selectors break after RFC update | MEDIUM | Extension can be updated and reloaded without App Store; hotfix selector in 1 day; add selector verification so failure is caught immediately |
| Export schema drift breaks import | LOW | Bump version number; add migration in extension import handler; redeploy both |
| Storage quota exhausted mid-session | HIGH | Items recorded after quota hit are lost; recovery requires manual re-dictation; prevent with proactive quota checks |
| API key exposed in frontend | HIGH | Rotate key immediately; audit API usage logs for unauthorized calls; move key to backend proxy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Web Speech API offline failure | Phase 1 — Core audio capture | Record 5 items in Airplane Mode; items appear in queue after reconnect |
| iOS permission re-prompt on route change | Phase 1 — Core audio capture | Navigate between 10 items on iPhone without permission dialog |
| Audio blob storage exhaustion | Phase 2 — Offline queue and sync | Record 50 items offline; verify storage estimate stays bounded; blobs deleted after transcription |
| AI field hallucination | Phase 3 — AI parsing pipeline | Test 20 dictations with absent fields; verify null returned, not invented values |
| DOM selector fragility in extension | Phase 4 — Chrome extension batch import | Write to `#fld1`, verify value, test with RFC page loaded |
| Background Sync iOS gap | Phase 2 — Offline queue and sync | Disable WiFi on iPhone, record 3 items, re-enable, confirm queue drains without app restart |
| Audio format mismatch iOS vs Android | Phase 1 — Core audio capture | Test upload path on both iOS Safari and Android Chrome |
| Export schema drift | Phase 1 — Project setup | Shared TypeScript types imported by both PWA and extension codebases |

---

## Sources

- [Web Speech API requires network — VocaFuse comparison](https://vocafuse.com/blog/web-speech-api-vs-cloud-apis/)
- [iOS Safari microphone permission bug on hash change — WebKit bug 215884](https://bugs.webkit.org/show_bug.cgi?id=215884)
- [PWA iOS limitations and Safari support guide — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [MediaRecorder iOS Safari — audio format and implementation](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription)
- [IndexedDB pitfalls — transactions, Safari WAL, eviction](https://gist.github.com/pesterhazy/4de96193af89a6dd5ce682ce2adff49a)
- [Offline storage Safari 7-day eviction — web.dev](https://web.dev/learn/pwa/offline-data/)
- [Background Sync browser support — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [Structured outputs do not prevent hallucination — Cognitive Today](https://www.cognitivetoday.com/2025/10/structured-output-ai-reliability/)
- [AI transcription hallucinations — Science/AAAS](https://www.science.org/content/article/ai-transcription-tools-hallucinate-too)
- [Chrome extension MV3 remote code restrictions — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [MediaRecorder mimeType — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType)
- [OpenAI Community — MediaRecorder with Whisper on mobile browsers](https://community.openai.com/t/mediarecorder-api-w-whisper-not-working-on-mobile-browsers/866019)
- [Offline-first IndexedDB and SQLite 2025 — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)

---
*Pitfalls research for: Mobile PWA speech-to-text auction cataloging app (TPC Speech Cataloger)*
*Researched: 2026-03-06*
