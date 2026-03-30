---
phase: 19
slug: photo-upload-to-supabase-storage-with-full-offline-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | Supabase migration | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | Photo upload queue | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | Upload trigger | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 1 | Sync status display | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 2 | Photo display fallback | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 2 | Export fallback | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 2 | Migration detection | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 19-04-02 | 04 | 2 | Drain order | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for photo upload queue (retry logic, bounded concurrency)
- [ ] Test stubs for photo display fallback (Dexie-first, signed URL fallback)
- [ ] Test stubs for migration detection (scan + backfill logic)
- [ ] Test stubs for export fallback (Storage download when Dexie blob missing)

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sync icon overlay on thumbnails | Upload status display | Visual UI state | Capture photo, verify spinner → check → retry states visible |
| Background migration progress | Migration UX | Visual indicator | Log in with un-uploaded Dexie photos, verify progress indicator |
| Offline queue drain on reconnect | Drain order | Network state toggle | Toggle airplane mode, capture photos, reconnect, verify upload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
