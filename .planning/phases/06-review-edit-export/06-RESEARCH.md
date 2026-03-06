# Phase 6: Review, Edit, Export - Research

**Researched:** 2026-03-06
**Domain:** React inline editing, list virtualization, Web Share API, Blob-to-JSON export
**Confidence:** HIGH

## Summary

Phase 6 builds the review/edit screen for session items and the JSON export mechanism. The review screen uses expandable cards showing AI-extracted fields, with inline editing via the same blur-to-save pattern established in Phase 3. Items can be deleted (soft or hard), re-recorded (appending AI results), and manually created. Export converts Dexie Blob data to base64 strings and delivers the JSON file via the Web Share API (`navigator.share` with files).

The existing codebase provides strong foundations: `ItemList` component already renders items per session, `SwipeableRow` handles swipe-to-delete, `ConfirmDialog` handles confirmations, `useAudioRecorder` manages recording lifecycle, and `ExportSchema` in `src/db/types.ts` defines the exact output format. The main new work is: (1) expanding `ItemList`/`ItemRow` into expandable cards with editable fields, (2) building the export pipeline (query items + photos + audio from Dexie, convert blobs to base64, assemble JSON, share as file), and (3) wiring re-record to append AI results.

**Primary recommendation:** Build on existing components -- refactor `ItemList` into expandable cards with inline editing, add item CRUD operations to `src/db/sessions.ts` (or a new `src/db/items.ts`), and create `src/utils/export.ts` for the export pipeline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Expandable cards -- compact rows by default, tap to expand and see all fields
- Collapsed row shows: item number (or receipt number for sale mode) + title + description preview
- Expanded card shows all fields: title, description, condition, estimate, category -- all visible, no secondary collapsible sections
- Must handle 300+ items efficiently (carried from Phase 4)
- Tap field to edit in-place -- field text becomes editable input right where it is
- Silent auto-save on blur, no save button (consistent with Phase 3 pattern)
- All fields always editable by typing, regardless of AI or manual population
- No auto-formatting at all -- fields stay exactly as Gemini returns them
- No format button, no format-on-export
- Re-record appends new AI results to existing field content (space/newline separator)
- Old fields stay visible during re-recording and processing -- not cleared
- Record button (small mic icon) available on collapsed card view for quick re-recording without expanding
- Recording is not the only way to add info -- all fields are directly typeable
- Fully manual item creation supported -- "Add Item" creates blank item, no audio required
- Deleted items removed from list and excluded from export
- Use ConfirmDialog for delete confirmation (existing component)
- Export button available from both session detail page and review screen
- Any session can be exported -- active sessions show a warning
- Delivery via Web Share API (`navigator.share`) -- share sheet includes Save to Files/Downloads
- Export uses existing `ExportSchema` from `src/db/types.ts` (versioned JSON, `"version": 1`)

### Claude's Discretion
- Expandable card animation and transition
- Compact row layout and spacing details
- "Add Item" button placement and styling
- Mic icon size and placement on collapsed cards
- Export button styling and placement on both screens
- Warning dialog text for active session export
- How delete action is triggered (swipe, button in expanded card, etc.)
- Field input types (input vs textarea) per field

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-01 | User can view all items in a session as a scrollable list with AI-extracted fields | Expandable card component with Dexie live queries; existing `ItemList` pattern to extend |
| EDIT-02 | User can edit any field inline | Blur-to-save pattern from Phase 3; Dexie `update()` on field change |
| EDIT-03 | User can delete an item from the session | `SwipeableRow` + `ConfirmDialog` existing; Dexie delete + re-index sortOrder |
| EDIT-04 | User can re-record audio for an item to regenerate AI fields | `useAudioRecorder` hook reuse; append pattern for AI results |
| EXPO-01 | User can export a session as JSON matching TPC extension schema | `ExportSchema` type exists; build export pipeline function |
| EXPO-02 | Export includes all fields including receipt numbers and photo references | Query all related tables in Dexie transaction; Blob-to-base64 conversion |
| EXPO-03 | User can download the export file to device storage | Web Share API with File object; fallback to download link |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2 | UI framework | Project standard |
| Dexie | 4.3 | IndexedDB wrapper | Project standard, live queries for reactive list |
| dexie-react-hooks | 4.2 | `useLiveQuery` hook | Reactive data binding |
| Zustand | 5.0 | UI state (expand/collapse, recording) | Project standard |
| Tailwind CSS | 4.2 | Styling | Project standard |
| React Router | 7.13 | Navigation | Project standard |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Share API | Browser native | File download/sharing | Export delivery |
| FileReader API | Browser native | Blob to base64 | Export pipeline |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    ItemList.tsx          # Refactored: expandable cards with inline edit
    ItemCard.tsx          # NEW: single expandable item card
    ExportButton.tsx      # NEW: export trigger with share/download
  db/
    items.ts             # NEW: item CRUD operations (create, update, delete)
  hooks/
    useSessionItems.ts   # NEW: live query for session items with expand state
  utils/
    export.ts            # NEW: export pipeline (query -> base64 -> JSON -> File)
  pages/
    SessionDetail.tsx    # Modified: add export button
```

### Pattern 1: Inline Editing with Auto-Save on Blur
**What:** Each field in an expanded card renders as text normally; tapping makes it an input/textarea. On blur, changes are written to Dexie immediately.
**When to use:** All editable fields (title, description, condition, estimate, category, receiptNumber).
**Example:**
```typescript
// Follows Phase 3 pattern from SessionDetail.tsx
function EditableField({ value, onSave, multiline }: {
  value: string | undefined;
  onSave: (val: string) => void;
  multiline?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleBlur = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? "")) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <span onClick={() => { setDraft(value ?? ""); setIsEditing(true); }}
            className="cursor-pointer hover:text-accent">
        {value || "(tap to add)"}
      </span>
    );
  }

  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag ref={inputRef as any} value={draft}
         onChange={(e) => setDraft(e.target.value)}
         onBlur={handleBlur}
         onKeyDown={(e) => { if (e.key === "Escape") setIsEditing(false); }}
         className="w-full rounded border px-2 py-1 ..." />
  );
}
```

### Pattern 2: Expandable Card with Collapse/Expand
**What:** Each item renders as a compact row by default. Tapping the row (not a field) toggles expansion to show all fields.
**When to use:** Item list display.
**Example:**
```typescript
function ItemCard({ item, mode, isExpanded, onToggle }: Props) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Collapsed row - always visible */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-3 py-2.5">
        <span className="font-medium">
          {mode === "sale" ? (item as SaleItem).receiptNumber : `Item ${item.sortOrder + 1}`}
        </span>
        <span className="truncate text-gray-600">{item.title}</span>
        <span className="truncate text-gray-400 text-sm">{item.description?.slice(0, 40)}</span>
        {/* Mic icon for quick re-record */}
        <MicButton itemId={item.id!} itemType={mode} />
        <ChevronIcon expanded={isExpanded} />
      </button>

      {/* Expanded section */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t">
          <EditableField label="Title" value={item.title} onSave={...} />
          <EditableField label="Description" value={item.description} onSave={...} multiline />
          <EditableField label="Condition" value={item.condition} onSave={...} />
          <EditableField label="Estimate" value={item.estimate} onSave={...} />
          <EditableField label="Category" value={item.category} onSave={...} />
        </div>
      )}
    </div>
  );
}
```

### Pattern 3: Export Pipeline
**What:** Gather all session data from Dexie, convert blobs to base64, assemble `ExportSchema`, create File, share via Web Share API.
**When to use:** Export button tap.
**Example:**
```typescript
// src/utils/export.ts
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function buildExportData(sessionId: number): Promise<ExportSchema> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  const table = session.mode === "house" ? db.houseVisitItems : db.saleItems;
  const items = await table.where("sessionId").equals(sessionId).sortBy("sortOrder");

  const exportItems = await Promise.all(items.map(async (item) => {
    const photos = await db.photos.where("itemId").equals(item.id!).sortBy("sortOrder");
    const audioRecords = await db.audio.where("itemId").equals(item.id!).toArray();

    return {
      title: item.title,
      description: item.description,
      condition: item.condition,
      estimate: item.estimate,
      category: item.category,
      receiptNumber: "receiptNumber" in item ? item.receiptNumber : undefined,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
      photos: await Promise.all(photos.map(async (p) => ({
        blob: await blobToBase64(p.blob),
        sortOrder: p.sortOrder,
      }))),
      audio: await Promise.all(audioRecords.map(async (a) => ({
        blob: await blobToBase64(a.blob),
        mimeType: a.mimeType,
        durationMs: a.durationMs,
      }))),
    };
  }));

  const { id, deletedAt, ...sessionData } = session;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: sessionData,
    items: exportItems,
  };
}

async function exportSession(sessionId: number): Promise<void> {
  const data = buildExportData(sessionId);
  const json = JSON.stringify(await data, null, 2);
  const file = new File([json], `tpc-session-${sessionId}.json`, {
    type: "application/json",
  });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
  } else {
    // Fallback: create download link
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### Pattern 4: Item CRUD Operations
**What:** Centralized data operations for items, similar to `src/db/sessions.ts`.
**Example:**
```typescript
// src/db/items.ts
export async function updateItemField(
  id: number,
  mode: "house" | "sale",
  field: string,
  value: string,
): Promise<void> {
  const table = mode === "house" ? db.houseVisitItems : db.saleItems;
  await table.update(id, { [field]: value });
}

export async function deleteItem(id: number, mode: "house" | "sale"): Promise<void> {
  await db.transaction("rw", [
    mode === "house" ? db.houseVisitItems : db.saleItems,
    db.photos, db.audio
  ], async () => {
    await db.photos.where("itemId").equals(id).delete();
    await db.audio.where("itemId").equals(id).delete();
    const table = mode === "house" ? db.houseVisitItems : db.saleItems;
    await table.delete(id);
  });
}

export async function createBlankItem(
  sessionId: number,
  mode: "house" | "sale",
): Promise<number> {
  const table = mode === "house" ? db.houseVisitItems : db.saleItems;
  const count = await table.where("sessionId").equals(sessionId).count();
  const id = await table.add({
    sessionId,
    sortOrder: count,
    createdAt: new Date(),
  } as any);
  return id as number;
}
```

### Anti-Patterns to Avoid
- **Storing edit state in Zustand for each field:** Use local component state for editing draft, write to Dexie on blur. Zustand only for UI concerns (which card is expanded).
- **Re-rendering entire list on single field edit:** `useLiveQuery` per-card or per-item avoids this -- Dexie's reactivity only triggers for the changed record.
- **Converting blobs synchronously during render:** Export pipeline must be async, triggered by button, with loading state.
- **Using `map()` for 300+ items without any virtualization consideration:** For this phase, CSS overflow-y scroll with expandable cards is acceptable since only collapsed rows render by default. Full virtualization would conflict with variable-height expanded cards. Monitor performance; if it's an issue, consider windowing in a future phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialogs | Custom modal | `ConfirmDialog` component | Already exists with destructive variant |
| Swipe-to-delete gesture | Custom touch handler | `SwipeableRow` component | Already handles pointer events, direction lock, snap |
| Audio recording | Custom MediaRecorder wrapper | `useAudioRecorder` hook | Handles getUserMedia, MIME detection, Dexie save |
| Reactive data from IndexedDB | Manual subscriptions | `useLiveQuery` from dexie-react-hooks | Auto-updates on data change |
| File download fallback | Custom download logic | `URL.createObjectURL` + anchor click | Standard browser pattern, 3 lines |

**Key insight:** This phase's strength comes from composing existing components. The main new code is the expandable card UI and the export pipeline.

## Common Pitfalls

### Pitfall 1: Web Share API Not Available on Desktop
**What goes wrong:** `navigator.share` is undefined on desktop browsers (except recent Edge/Chrome on Windows/macOS).
**Why it happens:** Web Share API is primarily a mobile API; desktop support is limited.
**How to avoid:** Always check `navigator.canShare?.({ files: [file] })` before calling share. Provide download-link fallback (`URL.createObjectURL` + `<a download>`).
**Warning signs:** Export button does nothing on desktop during testing.

### Pitfall 2: Large Export Files with Photo Blobs
**What goes wrong:** Base64-encoding photos (each 100KB-2MB) can create multi-megabyte JSON files. With 300 items and multiple photos, this can cause memory pressure on mobile.
**Why it happens:** Base64 adds ~33% overhead; entire JSON string held in memory.
**How to avoid:** Photos are already resized (Phase 4 image resize). For now, proceed with base64 in JSON as specified by `ExportSchema`. If performance becomes an issue, consider streaming or splitting in Phase 9.
**Warning signs:** Export takes >5 seconds or causes jank on older phones.

### Pitfall 3: Re-record Append Race Condition
**What goes wrong:** User taps re-record, recording saves audio, AI processes it, and results need to append to existing fields. If user edits a field while AI is processing, the append could overwrite.
**Why it happens:** AI processing is async (Phase 5); field edits are synchronous blur-saves.
**How to avoid:** Re-record should read current field values at the time of AI result arrival, then append. Use `db.table.where().modify()` to atomically read+append rather than `update()`.
**Warning signs:** Edited field content disappears after re-record completes.

### Pitfall 4: Expand/Collapse State Lost on Re-render
**What goes wrong:** `useLiveQuery` re-triggers when any item in the list changes, causing all cards to collapse.
**Why it happens:** If expand state is stored relative to the query result array, it resets when the array reference changes.
**How to avoid:** Store expanded item IDs in a `Set<number>` in local state or Zustand, keyed by item `id` not array index.
**Warning signs:** Editing a field in an expanded card causes it to collapse.

### Pitfall 5: Blur Event Conflicts with Button Clicks
**What goes wrong:** User clicks a button (delete, re-record) while a field is focused. The blur fires first, potentially triggering state changes that interfere with the button click.
**Why it happens:** `blur` fires before `click` in the DOM event order.
**How to avoid:** Use `onMouseDown` with `preventDefault()` on buttons that should not steal focus, or use a small `setTimeout` in blur handlers. The Phase 3 inline edit pattern already handles this via `onBlur` + `onKeyDown`.
**Warning signs:** Delete button requires two taps, or field saves before dialog appears.

## Code Examples

### Blob to Base64 Conversion
```typescript
// Source: Standard FileReader API pattern
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob); // Returns "data:mime;base64,..."
  });
}
```

### Web Share API with File Fallback
```typescript
// Source: MDN Navigator.share() + canShare()
async function shareFile(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
  } else {
    // Fallback for desktop or unsupported browsers
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
```

### Dexie Atomic Field Append (for Re-record)
```typescript
// Source: Dexie modify() pattern from existing codebase
async function appendToField(
  id: number,
  mode: "house" | "sale",
  field: string,
  newContent: string,
): Promise<void> {
  const table = mode === "house" ? db.houseVisitItems : db.saleItems;
  await table.where("id").equals(id).modify((item: any) => {
    const existing = item[field] ?? "";
    item[field] = existing ? `${existing}\n${newContent}` : newContent;
  });
}
```

### Editable Field Component Pattern
```typescript
// Source: Phase 3 SessionDetail.tsx inline edit pattern
function EditableField({ value, onSave, placeholder, multiline }: {
  value: string | undefined;
  onSave: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) { ref.current?.focus(); ref.current?.select(); }
  }, [editing]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? "")) onSave(trimmed);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value ?? ""); setEditing(true); }}
        className="cursor-pointer min-h-[2rem] block text-gray-900 dark:text-gray-100
                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -mx-1"
      >
        {value || <span className="text-gray-400">{placeholder ?? "Tap to add"}</span>}
      </span>
    );
  }

  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag
      ref={ref as any}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) save();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-full rounded-lg border border-gray-300 dark:border-gray-600
                 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-gray-100
                 focus:outline-none focus:ring-2 focus:ring-accent"
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Download via `<a href="blob:..." download>` only | Web Share API with download fallback | Safari 15+ / Chrome 93+ | Native share sheet on mobile = "Save to Files" option |
| `JSON.stringify` with replacer for Blobs | FileReader `readAsDataURL` for base64 | N/A (always required) | Blobs cannot be JSON-stringified; must convert first |
| Separate "Review" page | Review integrated into session detail | Project decision | Less navigation; items visible from session detail |

## Open Questions

1. **Photo export size impact**
   - What we know: Photos are resized in Phase 4 (image resize). ExportSchema uses base64 strings.
   - What's unclear: With 300 items x multiple photos, what's the practical JSON file size? Could exceed 100MB.
   - Recommendation: Proceed with current approach. If file sizes are problematic, address in Phase 9 (deferred items) with streaming or zip compression.

2. **aiStatus field from Phase 5**
   - What we know: CONTEXT.md mentions `aiStatus` field on items to indicate processing state.
   - What's unclear: Phase 5 hasn't been implemented yet -- this field doesn't exist in current types.
   - Recommendation: Plan should assume Phase 5 adds `aiStatus` to item types. Review card should show a processing indicator when `aiStatus === "processing"` and disable re-record while processing.

3. **Re-record AI pipeline integration**
   - What we know: Re-record creates new audio, and AI results should append to existing fields.
   - What's unclear: How exactly the Phase 5 AI pipeline is invoked after recording. Is it automatic? Does it write results directly to Dexie?
   - Recommendation: Assume Phase 5 provides a function or hook that takes an audio blob/id and an item id, processes it, and writes results to Dexie. The re-record feature in Phase 6 should: (1) record audio via `useAudioRecorder`, (2) trigger AI processing, (3) on completion, append results to existing fields using `modify()`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | Items render as scrollable list with fields | unit | `npx vitest run src/tests/item-list.test.tsx -x` | No - Wave 0 |
| EDIT-02 | Inline field edit saves to Dexie on blur | unit | `npx vitest run src/tests/inline-edit.test.tsx -x` | No - Wave 0 |
| EDIT-03 | Item deletion removes from DB and list | unit | `npx vitest run src/tests/item-crud.test.ts -x` | No - Wave 0 |
| EDIT-04 | Re-record creates audio and triggers AI append | unit | `npx vitest run src/tests/re-record.test.ts -x` | No - Wave 0 |
| EXPO-01 | Export produces valid ExportSchema JSON | unit | `npx vitest run src/tests/export.test.ts -x` | No - Wave 0 |
| EXPO-02 | Export includes all fields, receipt numbers, photos | unit | `npx vitest run src/tests/export.test.ts -x` | No - Wave 0 |
| EXPO-03 | Share/download delivers file to user | unit | `npx vitest run src/tests/export.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/item-crud.test.ts` -- covers EDIT-03 (item create/update/delete operations)
- [ ] `src/tests/export.test.ts` -- covers EXPO-01, EXPO-02, EXPO-03 (export pipeline, blob conversion)
- [ ] `src/tests/inline-edit.test.tsx` -- covers EDIT-02 (editable field component)
- [ ] `src/tests/item-list.test.tsx` -- covers EDIT-01 (item list rendering)
- [ ] `src/tests/re-record.test.ts` -- covers EDIT-04 (re-record append logic)
- Framework and test setup already exist (`vite.config.ts` test section, `src/tests/setup.ts`)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/db/types.ts` (ExportSchema), `src/components/ItemList.tsx`, `src/components/SwipeableRow.tsx`, `src/components/ConfirmDialog.tsx`, `src/hooks/useAudioRecorder.ts`, `src/pages/SessionDetail.tsx`
- [MDN Navigator.share()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) -- Web Share API reference
- [MDN Navigator.canShare()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare) -- feature detection for file sharing

### Secondary (MEDIUM confidence)
- [Can I Use Web Share](https://caniuse.com/web-share) -- browser support tables
- [web.dev Web Share](https://web.dev/articles/web-share) -- integration patterns

### Tertiary (LOW confidence)
- Photo export size impact at 300+ items -- needs real-world measurement

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- patterns follow existing Phase 3 conventions, well-understood React patterns
- Pitfalls: MEDIUM -- re-record append race condition and export size concerns are theoretical, need validation during implementation
- Export/Share: HIGH -- Web Share API well-documented, fallback pattern straightforward

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- no fast-moving dependencies)
