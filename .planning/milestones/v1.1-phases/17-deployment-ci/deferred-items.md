# Deferred Items - Phase 17

## Vitest 4.x Local Test Execution

**Discovered during:** 17-04 E2E verification
**Severity:** Medium (local dev only -- CI may not be affected)
**Description:** Running `npx vitest --run` locally produces "No test suite found" errors across all 87 test files. Vitest 4.0.18 with `globals: true` and Node v24.11.1 on Windows 11. Previously passing (649 tests) on same codebase. May be related to vitest 4.x breaking changes, node 24.x compatibility, or `.claude/worktrees/` symlinked directories confusing test discovery.
**Impact:** Local test runs fail. CI (ubuntu-latest, `npm ci` fresh install, node 22) may work fine since it uses a clean environment.
**Recommended action:** Pin vitest version or investigate vitest 4.x migration guide. Also add `.claude/` to vitest exclude pattern.
