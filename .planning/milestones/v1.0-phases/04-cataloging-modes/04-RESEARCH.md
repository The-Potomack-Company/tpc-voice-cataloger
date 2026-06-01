# Phase 4: Cataloging Modes - Research

**Researched:** 2026-03-06
**Domain:** Mobile cataloging workflows (photo capture, item progression, receipt number entry)
**Confidence:** HIGH

## Summary

Phase 4 builds the core item-by-item cataloging workflow for two modes: house visit (photos + voice) and sale cataloging (receipt numbers + voice). The database schema, types, audio recording infrastructure, and session management patterns are already in place from Phases 1-3. This phase focuses on building the item entry screen UI, photo capture/display pipeline, receipt number input, and "Next Item" progression flow.

The technical domain is straightforward -- HTML file input for camera access, canvas-based image resizing (already established in Phase 1 decisions), Dexie for immediate blob persistence, and standard React component patterns. No external libraries are needed beyond what is already installed. The lightbox for photo viewing can be built with simple React state and CSS transitions rather than adding a dependency, given the narrow requirements (swipe between photos, delete button).

**Primary recommendation:** Build a shared `ItemEntryScreen` component that conditionally renders photo capture (house mode) or receipt number input (sale mode) at the top, with the existing `RecordButton` at the bottom. Use Dexie `useLiveQuery` for reactive item/photo data. Persist photos immediately to IndexedDB as resized blobs. Build a simple custom lightbox overlay rather than adding a library dependency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Stacked layout: context area at top, record button at bottom
- House visit mode: camera button + horizontal scrollable photo thumbnail strip at top, record button at bottom
- Sale cataloging mode: receipt number text input at top (full XXXXX-N format, typed manually each time), record button at bottom
- Context strip shows item number (e.g., "Item 3 of 12") and captured content
- Camera button sits above the thumbnail strip in the top context area, not near the record button
- Native camera app via `<input type="file" capture="environment">` -- opens phone's camera, returns photo to app
- Quick preview after capture with Keep/Retake buttons before photo is added to the strip
- Photos land in horizontal thumbnail strip immediately after Keep
- Tap thumbnail opens full-screen lightbox with swipe left/right navigation and trash icon to delete
- Photos resized to ~2048px max dimension before storage (carried from Phase 1)
- No photo reordering in this phase (deferred to v2 PHOTO-01)
- Single editable text input field, user types full XXXXX-N receipt number each time
- No auto-increment, no split fields -- receipt numbers come from a pre-existing list
- Receipt number is required before recording (field at top of screen)
- Instant advance -- tap "Next Item", screen clears to fresh blank entry immediately, no confirmation or summary
- Warn if current item is completely empty (no recording, no photos): "This item has no recording or photos. Skip it?"
- Back button to return to previous item -- opens fully editable (can add photos, re-record, delete photos)
- Compact rows in item list: item number, capture indicator icons (mic icon if recorded, camera icon with photo count if house visit), receipt number if sale mode
- Tapping an item opens the fully editable item entry screen (consistent with back button behavior)
- Must handle 300+ items efficiently for large house visit sessions

### Claude's Discretion
- "Next Item" button placement and styling
- Back button placement and styling
- Photo thumbnail sizing and spacing in the strip
- Keep/Retake preview layout and animation
- Empty item warning dialog design
- Lightbox transition animation and gesture handling
- Receipt number field validation timing (on blur vs on submit)
- Item counter display format and positioning
- How the session detail screen integrates the "add new item" action alongside the item list

### Deferred Ideas (OUT OF SCOPE)
- Import a list of receipt numbers to pre-populate sale session items -- future phase
- Photo reordering / drag to set hero shot -- v2 (PHOTO-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HOUSE-01 | User can start a house visit session and catalog items one by one | Session creation exists (Phase 3 types), item entry screen with Next Item progression |
| HOUSE-02 | User can capture one or more photos per item using device camera | HTML file input with capture="environment", canvas resize to 2048px, Dexie blob storage |
| HOUSE-03 | User can view a photo gallery for each item showing all captured photos | Horizontal thumbnail strip + full-screen lightbox with swipe navigation |
| HOUSE-04 | User can tap "Next Item" to advance to a new blank entry | Instant advance with empty-item warning, Dexie item creation |
| SALE-01 | User can start a sale cataloging session | Session creation with mode="sale", navigates to item entry with receipt number field |
| SALE-02 | User can enter a receipt number (format XXXXX-N) before dictating each item | Text input with regex validation `/^\d{5}-\d+$/`, required before recording |
| SALE-03 | User can tap "Next Item" to advance to a new blank entry with receipt number field | Same Next Item logic as house mode, fresh receipt number field on new item |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.x | UI components | Already in project |
| React Router | 7.13.x | Pathname routing for session/item navigation | Already in project, avoids iOS mic re-prompt |
| Dexie | 4.3.x | IndexedDB wrapper for item/photo/audio storage | Already in project, sole source of truth |
| dexie-react-hooks | 4.2.x | `useLiveQuery` for reactive data binding | Already in project |
| Zustand | 5.0.x | UI state (current item index, lightbox state) | Already in project |
| Tailwind CSS | 4.2.x | Styling with @theme blocks | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | -- | -- | All functionality achievable with existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom lightbox | yet-another-react-lightbox-lite (~5KB) | Adds dependency for something achievable in ~80 lines of React + CSS. Custom is preferred given narrow requirements (just swipe + delete). |
| Canvas resize | browser-image-resizer npm | Extra dependency. Canvas API is 20 lines of code for this use case. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    SessionDetail.tsx     # Session detail with item list (new route)
    ItemEntry.tsx          # Item entry screen for both modes (new route)
  components/
    PhotoCapture.tsx       # Camera button + thumbnail strip + preview
    PhotoLightbox.tsx      # Full-screen photo viewer with swipe + delete
    ReceiptNumberInput.tsx # Validated receipt number field
    ItemList.tsx           # Compact item list for session detail
    ConfirmDialog.tsx      # Reusable confirm/cancel dialog
  hooks/
    useImageResize.ts     # Canvas-based image resizing utility hook
  utils/
    image.ts              # Image resize function (pure, testable)
```

### Pattern 1: Route-Based Item Navigation
**What:** Use React Router params for session and item navigation rather than component state
**When to use:** Always -- pathname-based routing is established project pattern and prevents iOS mic re-prompts
**Example:**
```typescript
// In App.tsx routes
<Route path="session/:sessionId" element={<SessionDetailPage />} />
<Route path="session/:sessionId/item/:itemIndex" element={<ItemEntryPage />} />

// Navigate to next item
navigate(`/session/${sessionId}/item/${currentIndex + 1}`);
```

### Pattern 2: Immediate Blob Persistence
**What:** Write photo blobs to Dexie immediately after Keep confirmation, never hold in React state
**When to use:** All photo capture operations
**Example:**
```typescript
// After user taps "Keep" on photo preview
const resizedBlob = await resizeImage(originalFile, 2048);
const thumbnailBlob = await resizeImage(originalFile, 200);
await db.photos.add({
  itemId,
  itemType: "house",
  blob: resizedBlob,
  thumbnail: thumbnailBlob,
  sortOrder: existingCount,
  createdAt: new Date(),
});
// useLiveQuery automatically re-renders thumbnail strip
```

### Pattern 3: useLiveQuery for Reactive Item Data
**What:** Use `useLiveQuery` from dexie-react-hooks for all data display, not manual state management
**When to use:** Item list, photo strip, item counts
**Example:**
```typescript
import { useLiveQuery } from "dexie-react-hooks";

// In ItemEntryPage
const photos = useLiveQuery(
  () => db.photos.where({ itemId }).sortBy("sortOrder"),
  [itemId]
);

// In SessionDetailPage - item list
const items = useLiveQuery(
  () => db.houseVisitItems.where({ sessionId }).sortBy("sortOrder"),
  [sessionId]
);
```

### Pattern 4: Shared Item Entry with Mode-Specific Top Section
**What:** Single `ItemEntryPage` component that renders different top sections based on session mode
**When to use:** The item entry screen
**Example:**
```typescript
function ItemEntryPage() {
  const { sessionId, itemIndex } = useParams();
  const session = useLiveQuery(() => db.sessions.get(Number(sessionId)));

  return (
    <div className="flex flex-col h-full">
      {/* Top: mode-specific content */}
      {session?.mode === "house" ? (
        <PhotoCapture itemId={currentItemId} />
      ) : (
        <ReceiptNumberInput itemId={currentItemId} />
      )}

      {/* Middle: item counter */}
      <ItemCounter current={itemIndex} total={totalItems} />

      {/* Bottom: record button + next item */}
      <RecordButton itemId={currentItemId} itemType={session?.mode} />
      <NextItemButton />
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Holding photo blobs in React state:** Blobs are large (2-5MB each). Store in Dexie immediately, reference by ID. useLiveQuery handles reactivity.
- **Loading all photos for a session at once:** With 300+ items and multiple photos each, load photos per-item using `where({ itemId })`, not all photos for a session.
- **Using component state for item navigation:** Use URL params via React Router. This preserves browser back button behavior and prevents iOS mic permission re-prompts.
- **Creating thumbnails on demand during render:** Generate and store thumbnails (200px) alongside full images at capture time. Thumbnail strip should read stored thumbnail blobs, not resize on every render.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resizing | Multi-pass resize algorithm | Simple canvas drawImage with imageSmoothingEnabled | Single downscale from phone camera (3000-4000px) to 2048px is a <2x reduction -- no multi-pass needed |
| Blob URL management | Manual URL.createObjectURL tracking | `useMemo` with `URL.createObjectURL` + cleanup in `useEffect` return | Leaking blob URLs causes memory issues with 300+ photos |
| Item sort ordering | Custom sort implementation | Dexie `sortBy("sortOrder")` and auto-increment sortOrder on new items | Dexie handles this natively |
| Confirm dialogs | Ad-hoc confirm() calls | Reusable `ConfirmDialog` component | Need consistent styling, accessible, used for empty-item warning and photo delete confirmation |

**Key insight:** This phase is UI-heavy but data-simple. The Dexie schema already has all needed tables and fields. The work is building the capture/entry UI and wiring it to existing storage.

## Common Pitfalls

### Pitfall 1: iOS Safari File Input Behavior in PWA
**What goes wrong:** `<input type="file" capture="environment">` may behave differently in PWA standalone mode vs browser on iOS. Some iOS versions show blank screen after photo capture.
**Why it happens:** WebKit bugs with file input in standalone PWA mode, particularly around returning from camera app.
**How to avoid:** Test on actual iOS device in standalone PWA mode. Use `accept="image/*"` alongside `capture="environment"`. Have a fallback that omits `capture` attribute if issues arise.
**Warning signs:** Photo capture works in Safari browser but fails in installed PWA.

### Pitfall 2: Memory Pressure with Many Blob URLs
**What goes wrong:** Creating `URL.createObjectURL()` for 300+ thumbnails without revoking causes memory leaks and eventual browser crashes.
**Why it happens:** Each blob URL holds a reference to the blob in memory until explicitly revoked.
**How to avoid:** Revoke blob URLs in useEffect cleanup. For the thumbnail strip, only create blob URLs for visible thumbnails. Use a virtualized approach or limit visible thumbnails if performance degrades.
**Warning signs:** Increasing memory usage in DevTools Performance tab as session grows.

### Pitfall 3: Photo Orientation (EXIF)
**What goes wrong:** Photos from mobile cameras often have EXIF orientation metadata. Canvas drawImage may not respect this, resulting in rotated images.
**Why it happens:** Camera sensors capture in landscape; EXIF rotation metadata tells viewers to display correctly.
**How to avoid:** Modern browsers (Chrome 81+, Safari 13.1+) auto-apply EXIF orientation when drawing to canvas via `createImageBitmap()`. Use `createImageBitmap(file)` instead of loading via `new Image()` + `img.src` for reliable orientation handling.
**Warning signs:** Thumbnails appear rotated 90 degrees on some photos.

### Pitfall 4: Race Condition on Rapid "Next Item" Taps
**What goes wrong:** Tapping "Next Item" quickly multiple times could create duplicate items or navigate to wrong index.
**Why it happens:** Item creation in Dexie is async; if user taps before previous creation resolves, multiple items get created.
**How to avoid:** Disable the "Next Item" button during item creation. Use a state flag or ref to prevent double-tap.
**Warning signs:** Extra blank items appearing in item list.

### Pitfall 5: Receipt Number Validation Edge Cases
**What goes wrong:** Users enter receipt numbers in unexpected formats (leading zeros, extra dashes, spaces).
**Why it happens:** Auctioneers are transcribing from physical receipts quickly.
**How to avoid:** Use a permissive regex `/^\d{5}-\d+$/` that matches the documented XXXXX-N format. Trim whitespace. Validate on blur with visual feedback, not on every keystroke.
**Warning signs:** Valid receipt numbers being rejected, or invalid ones accepted silently.

## Code Examples

### Image Resize Utility
```typescript
// src/utils/image.ts
export async function resizeImage(file: File, maxDimension: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let newWidth = width;
  let newHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      newWidth = maxDimension;
      newHeight = Math.round(height * (maxDimension / width));
    } else {
      newHeight = maxDimension;
      newWidth = Math.round(width * (maxDimension / height));
    }
  }

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}
```

### Photo Capture with Hidden File Input
```typescript
// Source: MDN HTML Media Capture + project patterns
function PhotoCapture({ itemId }: { itemId: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleKeep = async () => {
    if (!pendingFile) return;
    const resized = await resizeImage(pendingFile, 2048);
    const thumbnail = await resizeImage(pendingFile, 200);
    const count = await db.photos.where({ itemId }).count();
    await db.photos.add({
      itemId,
      itemType: "house",
      blob: resized,
      thumbnail,
      sortOrder: count,
      createdAt: new Date(),
    });
    cleanup();
  };

  const cleanup = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
      <button onClick={() => inputRef.current?.click()}>
        {/* Camera icon */}
      </button>
      {preview && (
        <PhotoPreview
          src={preview}
          onKeep={handleKeep}
          onRetake={cleanup}
        />
      )}
    </>
  );
}
```

### Receipt Number Validation
```typescript
const RECEIPT_PATTERN = /^\d{5}-\d+$/;

function ReceiptNumberInput({ value, onChange }: Props) {
  const [touched, setTouched] = useState(false);
  const isValid = RECEIPT_PATTERN.test(value);

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        placeholder="XXXXX-N"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        onBlur={() => setTouched(true)}
        className={`... ${touched && !isValid ? "border-red-500" : ""}`}
      />
      {touched && !isValid && (
        <p className="text-sm text-red-500">Format: XXXXX-N (e.g., 12345-1)</p>
      )}
    </div>
  );
}
```

### Blob URL Memory Management
```typescript
// Safe blob URL hook for thumbnails
function useBlobUrl(blob: Blob | undefined): string | undefined {
  return useMemo(() => {
    if (!blob) return undefined;
    return URL.createObjectURL(blob);
  }, [blob]);

  // Note: cleanup needs useEffect
  // Better pattern:
}

function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [blob]);

  return url;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new Image()` + img.src for resize | `createImageBitmap(file)` | Chrome 50+ / Safari 15+ | Handles EXIF orientation automatically, no onload callback needed |
| `canvas.toBlob()` | `OffscreenCanvas.convertToBlob()` | Chrome 69+ / Safari 16.4+ | Non-blocking, works in workers. Falls back to regular canvas if needed |
| Manual photo file reader | `<input capture="environment">` | Stable for years | Opens native camera directly on mobile |

**Notes on OffscreenCanvas:**
- Supported in Chrome/Edge 69+, Safari 16.4+, Firefox 105+. Should be safe for target devices.
- If targeting older Safari (pre-16.4), fall back to regular `<canvas>` element with `canvas.toBlob()`.

## Open Questions

1. **OffscreenCanvas on target devices**
   - What we know: OffscreenCanvas is supported in Safari 16.4+ (iOS 16.4+), Chrome 69+
   - What's unclear: What minimum iOS version the client's auctioneers actually use
   - Recommendation: Use OffscreenCanvas with a fallback to regular canvas. Check at runtime via `typeof OffscreenCanvas !== 'undefined'`.

2. **Photo storage limits**
   - What we know: IndexedDB storage varies by browser. Safari allows ~1GB in PWA context. Chrome allows much more.
   - What's unclear: Whether 300+ items * 3-5 photos * 2MB each = 1.8-3GB will hit limits
   - Recommendation: Monitor storage usage. The resized images (2048px JPEG @ 0.85 quality) should be ~300-500KB each, making total around 450-750MB for a large session. This is within limits.

3. **Phase 3 session management status**
   - What we know: Phase 3 plans exist (.planning/phases/03-session-management/) but STATE.md shows only 2 phases completed. The Sessions page still shows empty state with "Phase 3+" comment.
   - What's unclear: Whether Phase 3 was actually executed or just planned
   - Recommendation: Phase 4 may need to include session creation flow if Phase 3 was not executed. The planner should check whether session CRUD operations exist before planning. If not, Phase 4 must build: session creation from New Session page, session detail page with item list, and basic session list rendering.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.x |
| Config file | vite.config.ts (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOUSE-01 | Start house visit session, create items sequentially | integration | `npx vitest run src/tests/item-entry.test.tsx -t "house visit" -x` | No - Wave 0 |
| HOUSE-02 | Capture photos via file input, resize, store in Dexie | unit | `npx vitest run src/tests/image-resize.test.ts -x` | No - Wave 0 |
| HOUSE-03 | View photo gallery (thumbnail strip + lightbox) | unit | `npx vitest run src/tests/photo-gallery.test.tsx -x` | No - Wave 0 |
| HOUSE-04 | Next Item creates new blank entry | integration | `npx vitest run src/tests/item-entry.test.tsx -t "next item" -x` | No - Wave 0 |
| SALE-01 | Start sale cataloging session | integration | `npx vitest run src/tests/item-entry.test.tsx -t "sale session" -x` | No - Wave 0 |
| SALE-02 | Enter receipt number in XXXXX-N format | unit | `npx vitest run src/tests/receipt-number.test.ts -x` | No - Wave 0 |
| SALE-03 | Next Item with fresh receipt number field | integration | `npx vitest run src/tests/item-entry.test.tsx -t "sale.*next" -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/image-resize.test.ts` -- covers HOUSE-02 (resize logic, JPEG output, dimension constraints)
- [ ] `src/tests/receipt-number.test.ts` -- covers SALE-02 (validation regex, edge cases)
- [ ] `src/tests/item-entry.test.tsx` -- covers HOUSE-01, HOUSE-04, SALE-01, SALE-03 (item creation, next item, session modes)
- [ ] `src/tests/photo-gallery.test.tsx` -- covers HOUSE-03 (thumbnail rendering, lightbox open/close)
- [ ] Mock for `createImageBitmap` and `OffscreenCanvas` in test setup (jsdom does not support these)

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/db/types.ts`, `src/db/index.ts` -- existing Dexie schema with all tables
- Project codebase: `src/hooks/useAudioRecorder.ts`, `src/components/RecordButton.tsx` -- existing audio infrastructure
- [MDN HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/capture) -- file input camera behavior
- [Dexie useLiveQuery docs](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) -- reactive query patterns
- [web.dev: Capturing an image from the user](https://web.dev/media-capturing-images/) -- image capture best practices

### Secondary (MEDIUM confidence)
- [Canvas image resize patterns](https://dev.to/taylorbeeston/resizing-images-client-side-with-vanilla-js-4ng2) -- resize approach verification
- [Apple Developer Forums: iOS file input issues](https://developer.apple.com/forums/thread/685295) -- iOS PWA camera behavior

### Tertiary (LOW confidence)
- [iOS 17 file input camera issue](https://community.weweb.io/t/file-input-camera-not-working-ios-17-and-chrome/17615) -- Chrome on iOS 17 specific issue (may be resolved in iOS 18)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and patterns established
- Architecture: HIGH -- building on existing Dexie schema and React component patterns
- Photo capture: MEDIUM -- iOS Safari PWA behavior can be unpredictable, needs device testing
- Pitfalls: HIGH -- well-documented issues with blob URLs, EXIF, and IndexedDB limits

**Critical finding:** Phase 3 (Session Management) may not have been executed yet. The NewSession page still creates orphan items with sessionId=0, and the Sessions page still shows "Phase 3+" placeholder comments. Phase 4 planning must account for potentially needing to build session creation and navigation flows.

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, no fast-moving dependencies)
