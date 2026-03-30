# Phase 20: Fix House Session JSON Import on RFC - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 20-fix-house-session-json-import-on-rfc
**Areas discussed:** Photo upload handling, Navigation: Next vs Add, Cross-repo scope, Field completeness

---

## Photo Upload Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse PortalUploadController pattern | Decode base64 to File, inject via FileInjector, wait for UploadDetector, sequential | ✓ |
| Upload all photos before saving | Fill text + upload all photos, THEN Save/Next | |
| You decide | Claude picks best approach | |

**User's choice:** Reuse PortalUploadController pattern (Recommended)
**Notes:** Proven pattern already working for photo batches in the extension.

| Option | Description | Selected |
|--------|-------------|----------|
| Fields first, then photos | Fill text fields, then upload photos, then Save+Next | ✓ |
| Photos first, then fields | Upload photos first, then fill text, then Save+Next | |
| You decide | Claude determines based on RFC behavior | |

**User's choice:** Fields first, then photos (Recommended)

---

## Navigation: Next vs Add

| Option | Description | Selected |
|--------|-------------|----------|
| Always Add new items | Always click Add to create new lot entries | |
| Next through existing, Add if needed | Walk forward with Next, fall back to Add when disabled/missing | ✓ |
| Always Next (existing only) | Only fill existing pages, never create new items | |

**User's choice:** Next through existing, Add if needed
**Notes:** Same pattern as PortalUploadController.navigateToNext().

| Option | Description | Selected |
|--------|-------------|----------|
| Save before Next/Add | Click Save after fields+photos, wait for reload, then Next/Add | ✓ |
| You decide | Claude determines save flow | |

**User's choice:** Save before Next/Add (Recommended)

---

## Cross-repo Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Not sure, check both sides | Investigate both TPC_App export and TPC_AI_Cataloger import | ✓ |
| Export is fine, fix import only | Problem is extension not consuming JSON properly | |
| Both likely need fixes | Suspect issues on both sides | |

**User's choice:** Not sure, check both sides

| Option | Description | Selected |
|--------|-------------|----------|
| Both repos in one phase | Fix both export and import in this phase | ✓ |
| Extension only, export separate | Fix import only, export changes in separate phase | |

**User's choice:** Both repos in one phase (Recommended)

---

## Field Completeness

| Option | Description | Selected |
|--------|-------------|----------|
| Those fields are correct | Title, description, condition, estimate, measurements, department are complete | ✓ |
| Missing some fields | Additional RFC fields needed | |
| Not sure, investigate | Claude checks RFC form fields | |

**User's choice:** All fields correct, but wants to add Style dropdown fix.
**Notes:** The Style dropdown (`#template`) must be set to "General" (value "2") during import to prevent the "Please change the Style to General and retry" blocker. User provided the HTML for the dropdown.

| Option | Description | Selected |
|--------|-------------|----------|
| Always set to General | Force Style to General regardless of current value | ✓ |
| Only if empty/unset | Only set if not already set | |
| You decide | Claude picks | |

**User's choice:** Always set to General (Recommended)

---

## Claude's Discretion

- Base64-to-File conversion implementation details
- State recovery approach for photo-upload-during-import flow
- Whether to refactor house mode into step-based state machine
- Error handling for individual photo upload failures
- Export JSON version detection

## Deferred Ideas

None — discussion stayed within phase scope
