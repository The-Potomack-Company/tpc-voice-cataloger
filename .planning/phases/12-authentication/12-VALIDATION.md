---
phase: 12
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | AUTH-01, AUTH-02 | unit | `npx vitest run src/tests/auth-store.test.ts -t "signIn"` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | AUTH-02 | unit | `npx vitest run src/tests/auth-store.test.ts -t "initialize"` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | AUTH-03 | unit (component) | `npx vitest run src/tests/protected-route.test.tsx` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | AUTH-01 | unit (component) | `npx vitest run src/tests/login-page.test.tsx -t "login"` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | AUTH-04 | unit | `npx vitest run src/tests/auth-store.test.ts -t "updatePassword"` | ❌ W0 | ⬜ pending |
| 12-03-02 | 03 | 2 | AUTH-04 | unit (component) | `npx vitest run src/tests/password-change.test.tsx` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 1 | INFRA-04 | unit | `npx vitest run src/tests/pwa-config.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/auth-store.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-04 (store actions and initialization)
- [ ] `src/tests/login-page.test.tsx` — stubs for AUTH-01 (login page UI and form behavior)
- [ ] `src/tests/protected-route.test.tsx` — stubs for AUTH-03 (redirect behavior)
- [ ] `src/tests/password-change.test.tsx` — stubs for AUTH-04 (password change form UI)
- [ ] `src/tests/pwa-config.test.ts` — stubs for INFRA-04 (Workbox config verification)

*Note: All tests mock `@supabase/supabase-js` — no local Supabase instance required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across browser close | AUTH-02 | Requires real browser lifecycle | 1. Log in, 2. Close browser, 3. Reopen — user should still be logged in |
| Service worker doesn't cache Supabase in production | INFRA-04 | Requires production build + SW | 1. Build, 2. Serve, 3. Check DevTools Network — Supabase requests show no SW cache hit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
