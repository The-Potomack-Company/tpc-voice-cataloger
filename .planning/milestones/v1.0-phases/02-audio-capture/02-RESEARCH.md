# Phase 2: Audio Capture - Research

**Researched:** 2026-03-06
**Domain:** MediaRecorder API, cross-browser audio capture, IndexedDB blob storage
**Confidence:** HIGH

## Summary

Phase 2 implements tap-to-record audio capture using the browser-native MediaRecorder API, storing audio blobs in the existing Dexie `audio` table. The critical challenge is cross-browser compatibility between iOS Safari (which produces `audio/mp4` with AAC codec) and Android Chrome (which produces `audio/webm;codecs=opus`). The project already uses pathname-based routing (React Router v7) specifically to avoid iOS Safari's microphone permission re-prompt bug on hash/navigation changes -- this was a Phase 1 decision that directly enables this phase.

The Dexie schema is already in place with an `ItemAudio` type containing `blob`, `mimeType`, and `durationMs` fields, so the storage layer requires no schema changes. The main implementation work is: (1) a `useAudioRecorder` hook wrapping MediaRecorder with proper lifecycle management, (2) a recording button component with visual state feedback, and (3) a toast notification for post-recording confirmation with inline playback.

**Primary recommendation:** Build a single `useAudioRecorder` custom hook that encapsulates all MediaRecorder logic, MIME type detection, and stream cleanup. Use `MediaRecorder.isTypeSupported()` for format detection -- never hardcode MIME types. Store the detected MIME type alongside the blob in Dexie.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Recording button: Large red circle with microphone icon, centered at bottom of screen. On tap (recording starts): button morphs to red square (universal "stop" symbol). Button sizing: Claude's discretion based on thumb-zone ergonomics (minimum 48px per Phase 1 UX-02)
- Recording indicator: Subtle MM:SS timer counting up near the record button. Red accent border/glow around screen edge while recording. No audio waveform or level meter
- Audio format: Store browser-native format as-is: `audio/mp4` (AAC) on iOS Safari, `audio/webm;codecs=opus` on Android Chrome. No on-device format conversion. MIME type saved alongside blob in Dexie
- Post-recording flow: Auto-save on stop, blob written to IndexedDB immediately, no confirmation step. Brief toast notification "Recording saved -- 0:23" with small play button for optional instant playback. Toast auto-dismisses after a few seconds. No persistent playback UI on recorded items in this phase

### Claude's Discretion
- Exact button sizing and spacing within thumb-zone constraints
- Toast duration and animation
- Red border/glow intensity and animation style
- Timer typography and exact placement relative to button
- MediaRecorder configuration (sample rate, bitrate, chunk strategy)
- Error handling for microphone permission denial
- Fallback behavior if MediaRecorder is unsupported

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | User can tap to start recording and tap again to stop for each item | MediaRecorder start/stop API; `useAudioRecorder` hook pattern with state machine (inactive/recording) |
| VOICE-02 | User can record audio that is stored locally as audio blob in IndexedDB | Dexie `audio` table already exists with `ItemAudio` type; blob + mimeType stored on `mediaRecorder.onstop` |
| VOICE-03 | User hears/sees clear feedback when recording is active vs stopped | Recording state drives UI: button morph (circle->square), MM:SS timer, red screen border |
| VOICE-04 | Audio recording works on both iOS Safari and Android Chrome | `MediaRecorder.isTypeSupported()` for format detection; pathname routing prevents iOS permission re-prompts |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MediaRecorder API | Web standard | Audio capture from microphone | Native browser API, no library needed; supported since Safari 14.1+ and Chrome 49+ |
| navigator.mediaDevices.getUserMedia | Web standard | Request microphone access | Standard permission + stream acquisition API |
| Dexie | ^4.3.0 | IndexedDB wrapper for blob storage | Already in project; `audio` table already defined |
| Zustand | ^5.0.11 | Recording UI state (isRecording, duration) | Already in project for state management |
| React | ^19.2.0 | Component rendering | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dexie-react-hooks | ^4.2.0 | `useLiveQuery` for reactive data | Already in project; use if needing to reactively display stored audio count |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw MediaRecorder | recordrtc, react-media-recorder | Unnecessary abstraction; raw API is simple enough for audio-only capture |
| Zustand for recording state | React useState | Zustand preferred per project conventions; recording state may be needed across components |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  hooks/
    useAudioRecorder.ts    # MediaRecorder lifecycle hook
  components/
    RecordButton.tsx        # Large red circle/square toggle button
    RecordingIndicator.tsx   # MM:SS timer + red screen border
    RecordingToast.tsx       # Post-recording confirmation with play button
  stores/
    recordingStore.ts        # Zustand store for recording state
  utils/
    audio.ts                 # MIME type detection, blob helpers
```

### Pattern 1: useAudioRecorder Hook
**What:** Custom hook encapsulating MediaRecorder lifecycle, stream management, and Dexie persistence
**When to use:** Any component that needs to start/stop recording
**Example:**
```typescript
// Source: MDN MediaRecorder API + project conventions

interface AudioRecorderState {
  status: 'idle' | 'requesting' | 'recording' | 'error';
  durationMs: number;
  error: string | null;
}

interface AudioRecorderActions {
  startRecording: (itemId: number, itemType: 'house' | 'sale') => Promise<void>;
  stopRecording: () => Promise<number | undefined>; // returns audio record ID
}

function useAudioRecorder(): AudioRecorderState & AudioRecorderActions {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  // ...

  const startRecording = async (itemId: number, itemType: 'house' | 'sale') => {
    // 1. getUserMedia({ audio: true })
    // 2. Detect MIME type via isTypeSupported()
    // 3. Create MediaRecorder with detected type
    // 4. Wire ondataavailable to collect chunks
    // 5. Wire onstop to assemble blob + write to Dexie
    // 6. mediaRecorder.start()
  };

  const stopRecording = () => {
    // 1. mediaRecorder.stop()
    // 2. Stop all tracks on the stream
    // 3. Return promise that resolves when onstop fires
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return { status, durationMs, error, startRecording, stopRecording };
}
```

### Pattern 2: MIME Type Detection
**What:** Runtime detection of supported audio MIME types using `MediaRecorder.isTypeSupported()`
**When to use:** Before creating MediaRecorder instance
**Example:**
```typescript
// Source: MDN MediaRecorder.isTypeSupported()

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',  // Chrome, Firefox, modern Safari
  'audio/webm',               // Chrome/Firefox fallback
  'audio/mp4',                // Safari/iOS
  'audio/ogg;codecs=opus',    // Firefox fallback
] as const;

function getPreferredMimeType(): string {
  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  // If none match, let the browser choose (empty string = browser default)
  return '';
}
```

### Pattern 3: Recording Timer with useRef + setInterval
**What:** Elapsed time counter that updates every second during recording
**When to use:** Display MM:SS timer near the record button
**Example:**
```typescript
// Timer runs via setInterval, updating state every second
const [elapsed, setElapsed] = useState(0);
const intervalRef = useRef<number | null>(null);

const startTimer = () => {
  setElapsed(0);
  intervalRef.current = window.setInterval(() => {
    setElapsed(prev => prev + 1);
  }, 1000);
};

const stopTimer = () => {
  if (intervalRef.current !== null) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
};

// Format as MM:SS
const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
```

### Pattern 4: Blob Storage to Dexie
**What:** Write audio blob + metadata to existing `audio` table immediately on stop
**When to use:** In the `onstop` handler of MediaRecorder
**Example:**
```typescript
// Source: existing src/db/types.ts ItemAudio interface

mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: detectedMimeType });
  const durationMs = Date.now() - startTime;

  const id = await db.audio.add({
    itemId,
    itemType,
    blob,
    mimeType: detectedMimeType || blob.type,
    durationMs,
    createdAt: new Date(),
  } as ItemAudio);

  // Return id for toast/confirmation
};
```

### Anti-Patterns to Avoid
- **Holding audio blob in React state:** Blobs are large binary data. Per project convention, Dexie/IndexedDB is the sole source of truth -- never store blobs in Zustand or useState.
- **Hardcoding MIME types:** Always use `isTypeSupported()` at runtime. iOS Safari and Android Chrome produce different formats and this can change between browser versions.
- **Forgetting to stop MediaStream tracks:** If you only call `mediaRecorder.stop()` without also calling `stream.getTracks().forEach(t => t.stop())`, the microphone remains active (browser shows recording indicator, battery drains).
- **Using hash-based routing:** The project already uses pathname-based routing specifically because iOS Safari re-prompts for microphone permission on hash changes in standalone PWA mode.
- **Using timeslice with start():** Calling `mediaRecorder.start(timeslice)` on Safari can produce unexpected chunk sizes and behavior. For audio-only recording, call `start()` without timeslice and collect the single blob on stop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio format detection | Custom UA sniffing or platform detection | `MediaRecorder.isTypeSupported()` | UA strings are unreliable; `isTypeSupported` is the standard API for this exact purpose |
| Audio blob storage | Custom IndexedDB wrapper | Dexie (already installed) | Dexie handles versioning, migrations, transactions, and has reactive hooks |
| Permission state tracking | Custom permission polling | `navigator.permissions.query({ name: 'microphone' })` | Standard API; note: not supported on all browsers, use as enhancement only |
| Audio playback | Custom audio player | `new Audio(URL.createObjectURL(blob))` or `<audio>` element | Native browser audio playback is sufficient for toast preview |

**Key insight:** MediaRecorder is a simple API for audio-only recording. The complexity is in cross-browser MIME type handling and iOS Safari quirks, not in the recording logic itself. No third-party recording library is needed.

## Common Pitfalls

### Pitfall 1: iOS Safari MIME Type Returns Empty String
**What goes wrong:** On some iOS Safari versions, `mediaRecorder.mimeType` returns an empty string even though the recording produces valid `audio/mp4` data.
**Why it happens:** Safari's MediaRecorder implementation historically did not populate the `mimeType` property reliably.
**How to avoid:** Detect the MIME type BEFORE creating the MediaRecorder using `isTypeSupported()`, store that detected type, and use it when creating the final Blob and when writing to Dexie. Do not rely on `mediaRecorder.mimeType` after recording.
**Warning signs:** Blobs stored with empty `mimeType` field in Dexie; playback fails because browser cannot determine format.

### Pitfall 2: Microphone Permission Re-prompts on iOS PWA
**What goes wrong:** Every time the user navigates to a different route, iOS Safari re-prompts for microphone permission.
**Why it happens:** WebKit bug #215884 -- standalone PWAs revoke getUserMedia permissions on hash changes.
**How to avoid:** Already mitigated: the project uses pathname-based routing (React Router v7), not hash routing. Additionally, avoid unnecessary page reloads. Request getUserMedia only when the user taps record, not on page load.
**Warning signs:** Users seeing "Allow Microphone" prompt every time they navigate back to recording screen.

### Pitfall 3: MediaStream Not Stopped After Recording
**What goes wrong:** Microphone icon stays active in browser/OS, battery drains, user trust eroded.
**Why it happens:** `mediaRecorder.stop()` stops recording but does NOT release the microphone. The MediaStream tracks must be explicitly stopped.
**How to avoid:** Always call `stream.getTracks().forEach(track => track.stop())` in both the stop handler AND in the useEffect cleanup function.
**Warning signs:** Red/orange microphone indicator persists in browser chrome after recording stops.

### Pitfall 4: ondataavailable Fires With Empty Data
**What goes wrong:** Safari can fire `ondataavailable` with `event.data.size === 0` when the user pauses/resumes or in certain edge cases.
**Why it happens:** Safari UI elements allow users to pause microphone access, producing zero-length data events.
**How to avoid:** Always check `event.data.size > 0` before pushing to the chunks array.
**Warning signs:** Final blob is smaller than expected or playback produces silence.

### Pitfall 5: Recording UI Persists After Component Unmount
**What goes wrong:** User navigates away while recording, MediaRecorder keeps running, state is orphaned.
**Why it happens:** No cleanup in useEffect.
**How to avoid:** useEffect cleanup must stop recording AND release the stream. Consider whether navigating away should auto-stop and auto-save, or discard the recording.
**Warning signs:** Multiple active microphone streams; app slowdown.

### Pitfall 6: Large Audio Blobs Exceed IndexedDB Quota
**What goes wrong:** Long recordings (10+ minutes) produce blobs exceeding storage limits.
**Why it happens:** Uncompressed or high-bitrate audio recordings can be large. IndexedDB has per-origin storage limits.
**How to avoid:** For typical auctioneer item dictation (30s-2min per item), this is unlikely to be an issue. AAC and Opus are both well-compressed. Consider showing a warning if recording exceeds 5 minutes.
**Warning signs:** `QuotaExceededError` in Dexie `add()` call.

## Code Examples

Verified patterns from official sources:

### getUserMedia Audio-Only Request
```typescript
// Source: MDN MediaDevices.getUserMedia()
async function requestMicrophone(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,   // Use simple constraint; avoid over-constraining
      video: false,
    });
    return stream;
  } catch (err) {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
          throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
        case 'NotFoundError':
          throw new Error('No microphone found. Please connect a microphone.');
        case 'NotReadableError':
          throw new Error('Microphone is in use by another application.');
        default:
          throw new Error(`Microphone error: ${err.message}`);
      }
    }
    throw err;
  }
}
```

### Complete MediaRecorder Setup
```typescript
// Source: MDN MediaRecorder API
function createRecorder(stream: MediaStream): { recorder: MediaRecorder; mimeType: string } {
  const mimeType = getPreferredMimeType();
  const options: MediaRecorderOptions = {};

  if (mimeType) {
    options.mimeType = mimeType;
  }

  // Optional: set audio bitrate (Claude's discretion)
  // options.audioBitsPerSecond = 128000; // 128kbps -- good quality for voice

  const recorder = new MediaRecorder(stream, options);
  return { recorder, mimeType: mimeType || recorder.mimeType || 'audio/webm' };
}
```

### Toast with Inline Playback
```typescript
// Source: project conventions (Tailwind + React)
interface ToastProps {
  durationFormatted: string;  // "0:23"
  audioBlob: Blob;
  mimeType: string;
  onDismiss: () => void;
}

function RecordingToast({ durationFormatted, audioBlob, mimeType, onDismiss }: ToastProps) {
  const audioUrl = useMemo(() => URL.createObjectURL(audioBlob), [audioBlob]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Auto-dismiss after 4 seconds
    const timer = setTimeout(onDismiss, 4000);
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, onDismiss]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white
                    px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
      <span>Recording saved -- {durationFormatted}</span>
      <button onClick={() => audioRef.current?.play()}>
        {/* play icon */}
      </button>
      <audio ref={audioRef} src={audioUrl} />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flash/Silverlight recording | MediaRecorder API | 2016+ (Chrome), 2021 (Safari 14.1) | No plugins needed; fully browser-native |
| WebM-only output | Browser-native format (WebM or MP4) | Safari 14.1+ | Must detect format at runtime; no single universal format |
| getUserMedia with callbacks | getUserMedia returning Promise | Chrome 47+ | Use async/await pattern |
| Separate Whisper transcription | Direct Gemini audio input | Project decision | Store raw audio format; no conversion needed |

**Deprecated/outdated:**
- `navigator.getUserMedia()` (old callback-based API): Use `navigator.mediaDevices.getUserMedia()` instead
- `MediaRecorder.ondataavailable = fn`: Still works but `addEventListener('dataavailable', fn)` is preferred
- `URL.createObjectURL(stream)`: Removed from spec; use `srcObject` for live streams, `createObjectURL` only for Blobs

## Open Questions

1. **Where does the record button live in the UI hierarchy?**
   - What we know: CONTEXT.md says "centered at bottom of screen" -- this conflicts with the existing bottom tab bar
   - What's unclear: Does the record button replace the tab bar on certain pages, float above it, or appear on a specific recording page?
   - Recommendation: Place the record button above the tab bar, within the main content area of a recording page (e.g., `/new` or a new `/record` route). The tab bar remains visible for navigation.

2. **Which page/route hosts the recording UI?**
   - What we know: The app has Sessions, New, and Settings pages. Recording is per-item within a session context.
   - What's unclear: Phase 3 (Session Management) will wrap recordings into sessions. For Phase 2, do we need a standalone recording page or modify the existing New Session page?
   - Recommendation: Create a minimal recording page at `/record` (or use the existing `/new` page) with just the record button. Phase 3 will restructure this into session-aware flow. Keep it simple for Phase 2.

3. **ItemId association before sessions exist**
   - What we know: `ItemAudio` requires `itemId` and `itemType` fields. But Phase 3 creates sessions/items.
   - What's unclear: How to store audio blobs in Phase 2 without a session/item context.
   - Recommendation: Create a temporary/orphan item record when recording starts, or allow `itemId` to be optional/null in Phase 2 and associate later. Alternatively, create a dummy session+item for Phase 2 testing. The planner should decide the simplest approach.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + jsdom |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | Tap start/stop toggles recording state | unit | `npx vitest run src/tests/audio-recorder.test.ts -t "start and stop"` | No -- Wave 0 |
| VOICE-02 | Audio blob written to IndexedDB on stop | unit | `npx vitest run src/tests/audio-recorder.test.ts -t "stores blob"` | No -- Wave 0 |
| VOICE-03 | Recording indicator visible when recording | unit | `npx vitest run src/tests/record-button.test.tsx -t "indicator"` | No -- Wave 0 |
| VOICE-04 | Cross-browser MIME type detection | unit | `npx vitest run src/tests/audio-utils.test.ts -t "mime type"` | No -- Wave 0 |
| VOICE-04 | iOS + Android manual verification | manual-only | N/A -- requires real devices | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/audio-recorder.test.ts` -- covers VOICE-01, VOICE-02 (useAudioRecorder hook tests with mocked MediaRecorder)
- [ ] `src/tests/record-button.test.tsx` -- covers VOICE-03 (component render tests for button states, timer, border)
- [ ] `src/tests/audio-utils.test.ts` -- covers VOICE-04 (MIME type detection with mocked isTypeSupported)
- [ ] Mock setup: MediaRecorder and getUserMedia mocks in `src/tests/setup.ts` (extend existing file)

## Sources

### Primary (HIGH confidence)
- [MDN MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) -- constructor, methods, events, properties
- [MDN MediaRecorder.isTypeSupported()](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static) -- format detection
- [MDN MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) -- microphone access
- Existing project code: `src/db/types.ts` (ItemAudio interface), `src/db/index.ts` (Dexie schema)

### Secondary (MEDIUM confidence)
- [Can I Use MediaRecorder](https://caniuse.com/mediarecorder) -- browser compatibility matrix
- [WebKit Bug #215884](https://bugs.webkit.org/show_bug.cgi?id=215884) -- getUserMedia permission re-prompts on hash changes in standalone PWA
- [Chrome Developers: MediaRecorder](https://developer.chrome.com/blog/mediarecorder) -- Chrome-specific implementation notes
- [Addpipe: MediaRecorder chunks](https://blog.addpipe.com/dealing-with-huge-mediarecorder-slices/) -- timeslice behavior and Safari chunk issues

### Tertiary (LOW confidence)
- [Build with Matija: iPhone Safari MediaRecorder](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription) -- practical iOS Safari patterns (could not fetch full content, referenced via search excerpts)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- MediaRecorder is a well-documented web standard; all project dependencies already installed
- Architecture: HIGH -- patterns are straightforward; existing Dexie schema already supports the use case
- Pitfalls: HIGH -- iOS Safari quirks are well-documented in WebKit bug tracker and MDN
- Cross-browser: MEDIUM -- specific Safari version behavior may vary; manual testing on real devices required for VOICE-04

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable web APIs, unlikely to change)
