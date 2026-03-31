# Phase 21: More Granularity with Description and Transcription - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 21-more-granularity-with-description-and-transcription
**Areas discussed:** Smart field merging, Measurements expansion, Spoken punctuation

---

## Smart Field Merging

### Default behavior for re-recordings

| Option | Description | Selected |
|--------|-------------|----------|
| Append/merge | New info gets added to existing fields | ✓ |
| Only fill empty fields | New recording only fills fields that are currently null/empty | |
| Ask user per-field | Show a diff/prompt letting user choose which fields to accept | |

**User's choice:** Append/merge
**Notes:** User wants non-destructive behavior -- people should be able to edit/add to fields automatically

### Merge implementation location

| Option | Description | Selected |
|--------|-------------|----------|
| AI handles merge | Send existing field values as context with new audio to Gemini | ✓ |
| App-side merge | AI extracts independently, app code combines | |

**User's choice:** AI handles merge
**Notes:** None

### Schema for merge response

| Option | Description | Selected |
|--------|-------------|----------|
| Final merged values | AI returns complete final value for each field after merging | ✓ |
| Value + action metadata | Each field includes action indicator (replace/append/unchanged) | |

**User's choice:** Final merged values
**Notes:** None

---

## Measurements Expansion

### Mixed measurement types

| Option | Description | Selected |
|--------|-------------|----------|
| Single field, all together | Everything in one measurements string | ✓ |
| Separate sub-fields | Split into dimensions, weight, karats as separate fields | |
| Measurements + separate karats | Keep dimensions/weight together, karats gets own field | |

**User's choice:** Single field, all together
**Notes:** Example format: "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt"

### Millimeter detection

| Option | Description | Selected |
|--------|-------------|----------|
| User must say the unit | AI only uses mm when user explicitly says "millimeters" or "mm" | ✓ |
| AI infers from context | AI guesses unit based on item type | |

**User's choice:** User must say the unit
**Notes:** None

### Weight units

| Option | Description | Selected |
|--------|-------------|----------|
| Ounces and grams | Covers most auction use cases | ✓ |
| Ounces, grams, and pounds | Also handle pounds for heavier items | |
| You decide | Claude picks reasonable weight units | |

**User's choice:** Ounces and grams
**Notes:** None

---

## Spoken Punctuation

### Punctuation scope

| Option | Description | Selected |
|--------|-------------|----------|
| All fields | Punctuation commands apply everywhere | ✓ |
| Transcript only | Only raw transcript gets punctuation parsed | |

**User's choice:** All fields
**Notes:** None

### Implementation layer

| Option | Description | Selected |
|--------|-------------|----------|
| AI prompt | Add punctuation instructions to Gemini system prompt | ✓ |
| Post-processing code | App code does find/replace after AI returns | |
| Both layers | AI prompt first, post-processing catches misses | |

**User's choice:** AI prompt
**Notes:** None

---

## Claude's Discretion

- Weight unit formatting convention (oz. vs ounces)
- Exact system prompt wording
- Whether Zod measurements schema changes from array to string/object

## Deferred Ideas

None
