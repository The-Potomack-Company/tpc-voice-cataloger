---
phase: 31
slug: sec-profiles-self-update-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 31-RESEARCH.md §Validation Architecture (V-1..V-7).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (`src/tests/`) for app-layer; raw SQL / `information_schema` for DB-layer; pgTAP optional if a local `supabase start` stack is available |
| **Config file** | `package.json` `"test": "vitest --run"` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` + DB-layer grant query (V-1) + `db:types` diff (V-7) |
| **Estimated runtime** | ~30–60 s (vitest); grant query <1 s |

---

## Sampling Rate

- **After every task commit:** `npm run test`
- **After migration apply:** `supabase db push --dry-run` → V-1 grant query → V-7 types diff
- **Before `/gsd:verify-work`:** Codex review pass + V-1..V-6 satisfied (V-2..V-5 via local pgTAP or Tier-2 smoke; V-6 authorized prod read)
- **Max feedback latency:** ~60 s (app-layer); DB-layer V-2..V-6 gated by stack availability

---

## Per-Task Verification Map

| Ver ID | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| V-1 | `authenticated`/`anon` lack UPDATE on `role`/`is_active` | T-31-01 | column grant revoked | SQL (information_schema) | `verify-profiles-grants.sql` (see RESEARCH Code Examples) | ❌ W0 | ⬜ pending |
| V-2 | specialist `PATCH {role:'admin'}` → 403/no-op | T-31-01 | escalation blocked (grant + trigger) | integration (negative) | pgTAP on local stack OR authorized prod PATCH w/ test specialist token | ❌ W0 | ⬜ pending |
| V-3 | specialist `PATCH {walkthrough_completed:true}` → success | — | legit self-write preserved | integration (positive) | same harness as V-2; also covered by walkthrough flow | ❌ W0 | ⬜ pending |
| V-4 | specialist `PATCH {theme:'dark'}` → success | — | legit self-write preserved | integration (positive) | same harness | ❌ W0 | ⬜ pending |
| V-5 | `admin-update-user` still toggles `is_active` | — | admin Edge path uninjured | integration (Edge path) | invoke Edge fn w/ admin token (activate+deactivate) — Tier-2 | partial (`src/tests/admin-api.test.ts` mocks invoke) | ⬜ pending |
| V-6 | admin-list audit clean (no rogue admin) | T-31-01 | no prior self-promotion | SQL (authorized prod read) | `select id,display_name,role,created_at from public.profiles where role='admin'` (D-08) | ❌ W0 | ⬜ pending |
| V-7 | `npm run db:types` zero diff | — | grant/trigger change is shape-neutral | regression | `npm run db:types && git diff --exit-code src/db/database.types.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/queries/verify-profiles-grants.sql` (or inline snippet) — V-1 grant assertion query
- [ ] OPTIONAL `supabase/tests/profiles_self_update.test.sql` (pgTAP) — automates V-1..V-5 IF a local `supabase start` stack is available; otherwise document V-2..V-6 as authorized-prod / Tier-2 manual steps (net-new pattern — neither SEC-4 nor SEC-1 precedent shipped pgTAP)
- [ ] Tier-2 smoke checklist entry: walkthrough write + theme write + admin activate/deactivate post-apply
- No new vitest framework install needed — suite exists.

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| V-6 admin-list audit | Inherently a prod read of user rows; D-08 authorized at execution | Run the admin-list SELECT under a named prod authorization; confirm only the known admin set |
| V-2..V-5 (absent local stack) | Require a running Postgres/PostgREST with seeded roles; if no `supabase start`, fall back to Tier-2 smoke / authorized prod with a disposable test specialist | Per RESEARCH §Validation Architecture |

*If a local supabase stack is available, V-1..V-5 become fully automated via the optional pgTAP file.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (V-1 grant query at minimum)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (app-layer)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
