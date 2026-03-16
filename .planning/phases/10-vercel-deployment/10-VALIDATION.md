---
phase: 10
slug: vercel-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npm run lint && npx tsc -b && npx vitest run && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npm run lint && npx tsc -b && npx vitest run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | vercel.json SPA rewrite | CI | `npm run build` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | Security headers | CI | `npm run build` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | basicSsl conditional | unit | `npx vitest run` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 1 | CI lint step | CI | `npm run lint` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 1 | CI typecheck step | CI | `npx tsc -b` | ✅ | ⬜ pending |
| 10-02-03 | 02 | 1 | CI test step | CI | `npx vitest run` | ✅ | ⬜ pending |
| 10-02-04 | 02 | 1 | CI build step | CI | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SPA routes work on refresh | SPA rewrite | Requires live deployed URL | Visit `/session/1` directly on deployed URL |
| Security headers present | Security headers | Requires live deployed URL | `curl -I https://tpc-catalog.vercel.app` |
| AI proxy works from prod | CORS restriction | Requires live deployed URL + Cloudflare Worker | Record audio, verify AI processing |
| Preview deploy created on PR | Preview deployments | Requires opening real PR | Open PR, check for preview URL comment |
| Branch protection enforced | Branch protection | Requires GitHub settings | Try merging PR without CI pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
