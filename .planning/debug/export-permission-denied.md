---
status: diagnosed
trigger: "NotAllowedError: Permission denied at SessionDetail.tsx:131 when trying to export a session"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: navigator.share() is called after an async gap from the user gesture, violating the transient activation requirement
test: trace call path from click to navigator.share()
expecting: async work (buildExportData) breaks the user activation chain
next_action: return diagnosis

## Symptoms

expected: Clicking "Export Session" should share or download the session JSON
actual: NotAllowedError: Permission denied thrown at line 131 (the await exportSession(sessionId) call)
errors: NotAllowedError: Permission denied
reproduction: Click Export Session button on any session
started: likely always broken on browsers enforcing transient activation for Web Share API

## Eliminated

(none needed - root cause identified on first pass)

## Evidence

- timestamp: 2026-03-16T00:00:00Z
  checked: SessionDetail.tsx handleExport and handleExportClick flow
  found: TWO async-gap paths both break transient activation
  implication: navigator.share() is never called within the user gesture window

- timestamp: 2026-03-16T00:00:00Z
  checked: export.ts exportSession function
  found: buildExportData does heavy async work (DB queries, blob-to-base64 conversions for all photos and audio) BEFORE calling navigator.share()
  implication: By the time navigator.share() fires, the transient user activation from the click has expired (browsers give ~5 seconds, this work can take much longer)

- timestamp: 2026-03-16T00:00:00Z
  checked: SessionDetail.tsx handleExportClick and handleConfirm paths
  found: For active sessions, the flow is click -> setConfirmAction("export") -> user clicks confirm -> handleConfirm() -> handleExport() -> exportSession(). The confirm dialog adds a SECOND async gap (dialog render + user interaction) which further disconnects from the original gesture. Even without the dialog, buildExportData's async work alone breaks activation.
  implication: Both code paths (direct export and confirm-then-export) lose transient activation

## Resolution

root_cause: navigator.share() is called after heavy async work (database queries + blob-to-base64 encoding for all photos/audio in buildExportData), which exhausts the browser's transient user activation window. The Web Share API requires the call to be within a direct user gesture context.
fix: (not applied - diagnosis only)
verification: (not applied)
files_changed: []
