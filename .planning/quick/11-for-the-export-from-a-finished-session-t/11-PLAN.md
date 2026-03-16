---
phase: quick-11
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/export.ts
  - src/tests/export.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Exported JSON filename uses the session title instead of numeric ID"
    - "Filename is sanitized for filesystem safety (no slashes, colons, etc.)"
    - "Existing tests pass and new filename behavior is tested"
  artifacts:
    - path: "src/utils/export.ts"
      provides: "exportSession with title-based filename"
    - path: "src/tests/export.test.ts"
      provides: "Test coverage for new filename format"
  key_links:
    - from: "src/utils/export.ts"
      to: "db.sessions"
      via: "session.name lookup for filename"
      pattern: "session\\.name"
---

<objective>
Change the exported JSON filename from `tpc-session-{id}.json` to `{session-title}.json` so files are easier to identify for upload.

Purpose: When exporting a finished session, the filename should reflect the session title (e.g., "Smith Estate Sale.json") rather than a meaningless numeric ID, making it easier to find and upload the correct file.
Output: Updated export utility and tests.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/utils/export.ts
@src/tests/export.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Use session title as export filename</name>
  <files>src/utils/export.ts, src/tests/export.test.ts</files>
  <behavior>
    - exportSession("Download Test") produces filename "Download Test.json" (anchor.download property)
    - Filename sanitizes unsafe filesystem characters: slashes, colons, angle brackets, pipes, question marks, asterisks, quotes, leading/trailing dots and spaces
    - Empty or whitespace-only session name falls back to "tpc-session-{id}.json"
    - Session name with special chars like "Smith's Estate 3/15" becomes "Smith's Estate 3-15.json"
  </behavior>
  <action>
In `src/utils/export.ts`:

1. Add a `sanitizeFilename` helper function that:
   - Replaces `/\:*?"<>|` characters with `-`
   - Trims leading/trailing dots and spaces
   - Collapses consecutive dashes into one
   - Returns the sanitized string

2. Modify `exportSession` to:
   - The function already calls `buildExportData` which fetches the session. Instead, fetch the session name directly from `db.sessions.get(sessionId)` before building export data (the session is already fetched inside buildExportData, but we need the name for the filename).
   - Actually, more efficient approach: refactor to get session name from the already-built export data: `data.session.name`
   - Set `a.download` to `${sanitizeFilename(data.session.name)}.json`
   - If sanitized name is empty, fall back to `tpc-session-${sessionId}.json`

In `src/tests/export.test.ts`:

3. Update the existing "downloads JSON file via anchor click" test to assert the filename uses the session name ("Download Test.json") instead of the session ID pattern.

4. Add a test for sanitizeFilename: slashes become dashes, empty input falls back.

5. Add a test for exportSession with a session whose name has special characters to verify sanitization.
  </action>
  <verify>
    <automated>npx vitest run src/tests/export.test.ts</automated>
  </verify>
  <done>Exported JSON files are named after the session title (sanitized for filesystem safety), with fallback to ID-based naming for edge cases. All export tests pass.</done>
</task>

</tasks>

<verification>
npx vitest run src/tests/export.test.ts
</verification>

<success_criteria>
- Exporting a session named "Smith Estate Sale" downloads "Smith Estate Sale.json"
- Special characters in session names are sanitized (slashes, colons become dashes)
- Empty session names fall back to "tpc-session-{id}.json"
- All existing and new export tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/11-for-the-export-from-a-finished-session-t/11-SUMMARY.md`
</output>
