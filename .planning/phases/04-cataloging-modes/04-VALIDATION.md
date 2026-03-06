---
phase: 4
slug: cataloging-modes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.x |
| **Config file** | vite.config.ts (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | HOUSE-01, HOUSE-04, SALE-01, SALE-03 | integration | `npx vitest run src/tests/item-entry.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | HOUSE-02 | unit | `npx vitest run src/tests/image-resize.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | HOUSE-03 | unit | `npx vitest run src/tests/photo-gallery.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | SALE-02 | unit | `npx vitest run src/tests/receipt-number.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/item-entry.test.tsx` — integration stubs for HOUSE-01, HOUSE-04, SALE-01, SALE-03
- [ ] `src/tests/image-resize.test.ts` — unit stubs for HOUSE-02 (resize logic, JPEG output, dimension constraints)
- [ ] `src/tests/photo-gallery.test.tsx` — unit stubs for HOUSE-03 (thumbnail rendering, lightbox open/close)
- [ ] `src/tests/receipt-number.test.ts` — unit stubs for SALE-02 (validation regex, edge cases)
- [ ] Mock for `createImageBitmap` and `OffscreenCanvas` in test setup (jsdom does not support these)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera opens native camera app | HOUSE-02 | Requires real device camera hardware | On mobile device: tap camera button, verify native camera opens, take photo, verify returned to app |
| Photo preview Keep/Retake flow | HOUSE-02 | Visual UI interaction on real device | Take photo, verify preview shows, tap Keep → photo in strip. Retake → camera reopens |
| Lightbox swipe navigation | HOUSE-03 | Touch gesture interaction | Tap thumbnail, verify fullscreen, swipe left/right between photos |
| iOS PWA camera behavior | HOUSE-02 | iOS-specific PWA limitations | Test on iOS Safari PWA: verify file input triggers camera correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
