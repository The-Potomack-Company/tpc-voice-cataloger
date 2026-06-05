# Phase 34: ios-memory-optimization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 34-ios-memory-optimization
**Areas discussed:** PERF-1 encode strategy, PERF-2 scope, PERF-3 hoist shape, Verification method

---

## PERF-1 encode strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Chunked in-memory base64 | Small change; fixes the multi-copy loop but still holds the full base64 payload | ✓ |
| Out-of-band Gemini Files API | True OOM fix (file URI only) but touches proxy → collides with Cloud Run migration (D-056, phase 40) | (deferred to phase 40) |

**User's choice:** "use recs" → chunked now, Files API noted for phase 40.
**Notes:** Files API gated on the proxy migration so the upload endpoint ships with the new Cloud Run proxy.

---

## PERF-2 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix master blob now | Stream-append/segment-and-discard this phase | |
| Defer | Continuous gated off (D-050), ROADMAP lower-priority; leave tracked TODO | ✓ |

**User's choice:** "use recs" → defer.
**Notes:** Chunked encoder (D-03) still flows through the continuous path if the helper is shared.

---

## PERF-3 hoist shape

| Option | Description | Selected |
|--------|-------------|----------|
| Session-level aggregate provider | One live query over the session, per-item meta map, slice-as-prop to ItemCard | ✓ |
| Memoize in place | Keep per-card queries but reduce re-renders | |

**User's choice:** "use recs" → aggregate provider, slice-as-prop, dumb ItemCard.

---

## Verification method

| Option | Description | Selected |
|--------|-------------|----------|
| Render-count + memory snapshots | CI render-count test + manual memory smoke | ✓ |

**User's choice:** "use recs".
**Notes:** Flagged that `measureUserAgentSpecificMemory()` is Chromium-only + needs cross-origin isolation, so it won't run on the iOS Safari target — memory becomes desktop-Chrome + manual iOS Web Inspector; render-count is the CI-testable win.

## Claude's Discretion

- Base64 chunk size (32 KB starting point).
- Provider shape: React context vs. lifted state in ItemList.

## Deferred Ideas

- Out-of-band Gemini Files API upload (PERF-1 structural fix) → Phase 40 with D-056 proxy migration.
- Continuous-mode master-blob rework (PERF-2) → when continuous re-enabled (D-050 rework).
