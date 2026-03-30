---
phase: 17
slug: deployment-ci
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` (test section at lines 61-65) |
| **Quick run command** | `npx vitest --run` |
| **Full suite command** | `npx eslint . && npx tsc -b && npx vitest --run && npx vite build` |
| **Estimated runtime** | ~7 seconds (tests) / ~30 seconds (full suite with build) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest --run`
- **After every plan wave:** Run `npx eslint . && npx tsc -b && npx vitest --run && npx vite build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | DEPLOY-02 | lint | `npx eslint .` | N/A (lint check) | ⬜ pending |
| 17-01-02 | 01 | 1 | DEPLOY-02 | typecheck | `npx tsc -b` | N/A (type check) | ⬜ pending |
| 17-01-03 | 01 | 1 | DEPLOY-02 | unit | `npx vitest --run` | ✅ (existing) | ⬜ pending |
| 17-02-01 | 02 | 1 | DEPLOY-01 | build | `npx vite build` | N/A (build command) | ⬜ pending |
| 17-03-01 | 03 | 2 | DEPLOY-02 | integration | Push PR, verify checks run | ❌ manual | ⬜ pending |
| 17-04-01 | 04 | 2 | DEPLOY-03 | unit | `cd proxy && npx vitest --run` | ❌ W0 | ⬜ pending |
| 17-05-01 | 05 | 3 | DEPLOY-04 | manual-only | Attempt direct push to main | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Fix 4 failing tests in `src/tests/account-management.test.tsx` and `src/tests/gemini-pipeline.test.ts`
- [ ] Fix 25 ESLint errors across multiple files
- [ ] Fix 3 TypeScript errors in `SessionCard.tsx`, `SessionDetail.tsx`, `authStore.ts`
- [ ] Optional: Add CORS unit tests for the Cloudflare Worker (`proxy/src/index.test.ts`)

*Pre-existing failures MUST be fixed before CI enforcement, otherwise every PR will be blocked.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI pipeline runs on PR | DEPLOY-02 | GitHub Actions external service | Push a branch, open PR, verify checks appear and run |
| Branch protection blocks direct push | DEPLOY-04 | GitHub setting, not testable locally | Attempt `git push origin main` directly, verify rejection |
| Vercel deploy succeeds | DEPLOY-01 | External service deployment | Merge to main, verify production URL loads app |
| Preview deploys work | DEPLOY-01 | External service deployment | Open PR, verify preview URL in PR comment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
