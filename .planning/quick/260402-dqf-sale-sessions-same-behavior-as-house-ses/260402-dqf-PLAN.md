---
phase: quick
plan: 260402-dqf
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pages/ItemEntry.tsx
autonomous: false
requirements: [SALE-DETAIL-PARITY]

must_haves:
  truths:
    - "Sale item detail view shows receipt number as the top field"
    - "Sale item detail view shows all editable fields: title, description, measurements, condition, estimate, category"
    - "Sale item detail view shows the record button (gated on valid receipt number)"
    - "Sale item detail view shows transcript/recordings list below record button"
    - "Sale item detail view has left/right arrow navigation between items"
    - "Sale item detail view does NOT show photo upload section"
  artifacts:
    - path: "src/pages/ItemEntry.tsx"
      provides: "Unified item detail view for both house and sale modes"
      contains: "EditableField.*title"
  key_links:
    - from: "src/pages/ItemEntry.tsx"
      to: "src/components/EditableField.tsx"
      via: "EditableField components rendered for sale mode"
      pattern: "mode === .sale.*EditableField|EditableField.*mode"
    - from: "src/pages/ItemEntry.tsx"
      to: "src/components/RecordButton.tsx"
      via: "RecordButton rendered for both modes"
      pattern: "RecordButton"
---

<objective>
Make sale session item detail view behave identically to house session item detail view, minus photo upload. Sale items get: receipt number (top field), all editable fields, record button, recordings list, item navigation arrows.

Purpose: Sale items currently show only a receipt number and record button. Users need the same full-featured detail view they get for house items -- editable fields populated by AI transcription, transcript list, and arrow navigation.
Output: Updated ItemEntry.tsx with unified rendering for both modes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260402-dqf-sale-sessions-same-behavior-as-house-ses/260402-dqf-CONTEXT.md
@src/pages/ItemEntry.tsx
</context>

<interfaces>
<!-- Key components already imported in ItemEntry.tsx -->
From src/components/EditableField.tsx:
  EditableField({ label, value, onSave, placeholder, multiline? })

From src/components/ReceiptNumberInput.tsx:
  ReceiptNumberInput({ value, onChange })

From src/components/RecordButton.tsx:
  RecordButton({ itemId, sessionId })

From src/components/RecordingsList.tsx:
  RecordingsList({ itemId })
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Unify sale item detail view with house item detail view</name>
  <files>src/pages/ItemEntry.tsx</files>
  <action>
Modify the ItemEntry.tsx component to give sale mode the same layout as house mode, minus PhotoCapture. Specific changes:

1. **Editable fields for sale mode** (lines ~202-245): Change the condition `mode === "house"` to render for BOTH modes. The editable fields block (title, description, measurements, condition, estimate, category) should render when `item` exists regardless of mode. Keep the existing house-mode condition for PhotoCapture only.

2. **Receipt number placement**: Move the sale-mode ReceiptNumberInput (currently lines ~247-254) to render ABOVE the editable fields block, inside the same `space-y-3` container. It should appear as the first field in a sale item's detail view. Keep it wrapped in the `onBlur={handleReceiptBlur}` div. Only render for `mode === "sale"`.

3. **Navigation arrows for both modes** (lines ~321-354): Change the condition `mode === "house" && item && !isNewItem` to `item && !isNewItem` so arrows render for both house and sale modes. No other changes to arrow logic needed -- prevItem/nextItem computation (lines ~120-125) is already mode-agnostic.

4. **Keep PhotoCapture house-only**: The PhotoCapture section (lines ~193-199) and photo lightbox (lines ~299-306) must remain gated on `mode === "house"`. Sale items do NOT get photo upload.

5. **Keep record-disable logic**: The `isRecordDisabled` check (line ~148-149) already gates on `mode === "sale"` for receipt number validation. This stays as-is.

Layout order for sale mode should be:
- Back button
- Receipt number input (top field)
- Editable fields (title, description, measurements, condition, estimate, category) in bordered card
- Item counter
- Record button (with receipt-gating message if needed)
- Recordings list
- Delete item button
- Navigation arrows (fixed position)
  </action>
  <verify>
    <automated>cd /c/Users/maser/TPC_App && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Sale item detail view renders receipt number as top field, all six editable fields, record button, recordings list, and left/right navigation arrows. PhotoCapture remains house-only. TypeScript compiles without errors.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify sale item detail view parity</name>
  <files>src/pages/ItemEntry.tsx</files>
  <action>Human verifies the sale item detail view visually and functionally matches the house item detail view (minus photo upload).</action>
  <what-built>Sale item detail view now matches house item detail view layout. Receipt number appears as the top field, followed by title/description/measurements/condition/estimate/category fields, record button, recordings list, and left/right arrow navigation. Photo upload is excluded.</what-built>
  <how-to-verify>
    1. Open the app in dev mode (`npm run dev`)
    2. Create or open a SALE session
    3. Tap into an item -- verify you see:
       a. Receipt number field at the top
       b. All six editable fields (title, description, measurements, condition, estimate, category) in a bordered card
       c. Record button (should be disabled/dimmed until receipt number is entered)
       d. Enter a receipt number, confirm record button becomes active
       e. Record audio and verify the recording appears in the recordings list below
       f. Verify left/right arrow navigation works between items
    4. Open a HOUSE session item -- verify it still works identically (with photo upload present)
    5. Verify sale items do NOT show a photo upload section
  </how-to-verify>
  <verify>Human confirms visual and functional parity</verify>
  <done>User approves the sale item detail view layout and behavior</done>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles: `npx tsc --noEmit`
- Sale item detail shows receipt number + 6 editable fields + record button + recordings + arrows
- House item detail unchanged (still has photo upload)
- Navigation arrows work in both modes
</verification>

<success_criteria>
- Sale item detail view is visually and functionally identical to house item detail view, except no photo upload
- Receipt number renders as the topmost field in sale mode
- Left/right arrow navigation works for sale items
- No regressions in house mode
</success_criteria>

<output>
After completion, create `.planning/quick/260402-dqf-sale-sessions-same-behavior-as-house-ses/260402-dqf-SUMMARY.md`
</output>
