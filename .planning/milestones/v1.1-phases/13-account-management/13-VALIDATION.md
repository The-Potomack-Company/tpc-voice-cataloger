---
phase: 13
slug: account-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

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
| 13-01-01 | 01 | 1 | ACCT-01 | unit | `npx vitest run src/tests/admin-api.test.ts -t "create"` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | ACCT-02 | unit | `npx vitest run src/tests/account-management.test.tsx -t "list"` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | ACCT-03 | unit | `npx vitest run src/tests/admin-api.test.ts -t "deactivate"` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | ACCT-04 | unit | `npx vitest run src/tests/admin-route-guard.test.tsx -t "specialist"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/admin-api.test.ts` — stubs for ACCT-01, ACCT-03 (mock `supabase.functions.invoke` and profile queries)
- [ ] `src/tests/account-management.test.tsx` — stubs for ACCT-02 (render account list with mock profile data)
- [ ] `src/tests/admin-route-guard.test.tsx` — stubs for ACCT-04 (guard redirects non-admin, renders for admin)

*Existing infrastructure covers framework setup (Vitest already configured).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edge Function deployment succeeds | ACCT-01, ACCT-03 | Requires live Supabase project | Deploy with `npx supabase functions deploy`, verify in Supabase dashboard |
| CORS headers work from browser | ACCT-01, ACCT-03 | Requires real browser preflight | Open app, create/deactivate account, check Network tab for CORS errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
