---
phase: 40-ai-proxy-cloud-run-migration
plan: 03
subsystem: ai-proxy
status: complete
tags: [cloud-run, cloudflare-worker, retirement, ai-proxy, migration]
requires:
  - 40-02 (Cloud Run path verified in prod — retirement gate)
provides:
  - Cloud Run as the sole AI proxy path (in-repo Worker removed)
affects:
  - src/tests/gemini-pipeline.test.ts
  - src/tests/geminiContinuous.test.ts
tech-stack:
  removed: [cloudflare-worker (tpc-gemini-proxy), wrangler]
  patterns: [single-commit-rollback]
key-files:
  created:
    - .planning/milestones/v1.3-phases/40-ai-proxy-cloud-run-migration/40-03-SUMMARY.md
  modified:
    - src/tests/gemini-pipeline.test.ts
    - src/tests/geminiContinuous.test.ts
  deleted:
    - proxy/ (entire self-contained tpc-gemini-proxy Worker sub-package)
decisions:
  - D-04: retire proxy/ in-phase as final step, isolated rollback commit
metrics:
  retirement-commit: f9f93dc
  files-deleted: 8
  files-modified: 2
  completed: 2026-06-02
---

# Phase 40 Plan 03: Retire in-repo CF Worker Summary

Deleted the dormant in-repo Cloudflare Worker (`proxy/` → `tpc-gemini-proxy`) as
the final migration step, making the `tpc-ai-proxy` Cloud Run service the sole AI
proxy path; kept it in one isolated commit so rollback is a clean revert or a
single `VITE_GEMINI_PROXY_URL` repoint.

## Gate (Plan 02)

Re-verified before any deletion: `40-02-SUMMARY.md` records
**"## CLOUD RUN PATH VERIFIED IN PROD"** (live AI record-and-process confirmed
end-to-end against Cloud Run in prod + dev). Gate met — safe to remove the
rollback target.

## What was done

**Task 1 — Worker deletion.** `git rm -r proxy/` removed the entire
self-contained sub-package (8 tracked files: `src/index.ts`, `src/index.test.ts`,
`wrangler.toml`, `package.json`, `package-lock.json`, `tsconfig.json`,
`vitest.config.ts`, `.gitignore`). Leftover untracked working-tree artifacts
(`node_modules/`, `.wrangler/`, `.dev.vars` — none repo-tracked) were removed
directly (not via `git clean`). Confirmed no `wrangler` / `tpc-gemini-proxy`
reference remains anywhere outside `proxy/` (checked `package.json`,
`vite.config.*`, `.github/`, plus a repo-wide grep) — `proxy/` was never a root
workspace and had no CI/vite wiring, so deletion was a clean directory drop.

**Task 2 — Test repoint + env scrub.** Repointed the placeholder proxy-URL stubs
off the retired Worker to the Cloud-Run-shaped prod URL
`https://tpc-ai-proxy-prod-588770300226.us-east1.run.app/`:
- `src/tests/gemini-pipeline.test.ts` line 42 (module-level stub) and line 329
  (env-restore inside the fail-closed test).
- `src/tests/geminiContinuous.test.ts` line 147 (`beforeEach` stub).

The fail-closed test (`fails immediately when VITE_GEMINI_PROXY_URL is not
configured`, sets `""`) was left intact (SC3). `.env.example` already carried the
Cloud Run prod URL from Plan 02 with no `localhost:8787`/Worker leftover, so no
scrub was needed.

**Task 3 — Isolated commit.** Staged ONLY the retirement set (8 proxy/ deletions
+ 2 test repoints) and committed once.

## Commit (cataloger repo, branch `gsd/v1.3-maturation`)

- **`f9f93dc`** — `chore(40): retire in-repo CF Worker (proxy/) — Cloud Run is sole AI proxy`
  - 10 files changed, 3 insertions, 3038 deletions.

## Verification

- Targeted: `npm test -- src/tests/gemini-pipeline.test.ts src/tests/geminiContinuous.test.ts` → 24/24 passed.
- Full suite: `npm test` → **692 passed, 49 todo, 4 files skipped, 0 failures** (95 files).
- Build: `npm run build` → exit 0 (only the pre-existing >500 kB chunk-size advisory; PWA SW generated).
- Commit gates: `git log -1 --name-only` shows proxy/ deletions + the two test files and NO unrelated files; subject references retiring the Worker; Co-Authored-By trailer present.

## Rollback procedure

Two independent paths (either suffices):

1. **Code rollback:** `git revert f9f93dc` — cleanly restores the in-repo Worker
   sub-package and the prior test stubs (this commit is isolated for exactly this
   purpose).
2. **Operational rollback (faster, no redeploy of code):** repoint
   `VITE_GEMINI_PROXY_URL` back to the old Worker URL in Vercel env
   (prod/preview) and redeploy. The cataloger's `src/services/` consumers read the
   env var unchanged, so flipping the URL is sufficient to route AI traffic back
   off Cloud Run. (Per D-04, this is the primary intended rollback.)

## Deviations from Plan

**[Scope boundary — out of scope, deferred]** Three additional test files carry
the same `test-proxy.example.com` placeholder stub:
`src/tests/gemini-determinism.test.ts:44`, `src/tests/gemini-confab-guard.test.ts:42`,
`src/tests/gemini-no-clobber.test.ts:54`. The plan scopes Task 2 explicitly to
`gemini-pipeline.test.ts` + `geminiContinuous.test.ts` (frontmatter `files_modified`
and the task `<files>` list), and Task 3 mandates ONLY the retirement changes with
NO unrelated files in the isolated rollback commit. Including these three would have
polluted the rollback commit. Left untouched and logged to `deferred-items.md`. They
are harmless placeholders (the stub URL is assertion-agnostic) and reference no live
Worker — purely a cosmetic-consistency follow-up.

## Self-Check: PASSED

- Retirement commit `f9f93dc` exists in `git log`.
- `proxy/` directory confirmed gone (`test ! -d proxy`).
- SUMMARY file created at the phase directory.
- Full suite + build both exit 0.
