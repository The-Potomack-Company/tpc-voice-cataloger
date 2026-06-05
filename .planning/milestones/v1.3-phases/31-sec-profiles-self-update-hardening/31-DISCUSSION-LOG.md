# Phase 31: sec-profiles-self-update-hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 31-sec-profiles-self-update-hardening
**Areas discussed:** Self-editable column allowlist, Apply policy

---

## Premise verification (pre-discussion)

Before discussing, the live prod DB (`wgrknodfxdjtddsirldw`) was queried read-only to confirm the threat. Result: vector confirmed open — permissive non-column-scoped self-update RLS policy + `UPDATE` grants to `authenticated`+`anon` on `role`/`is_active` + no guard trigger. Also surfaced that the threat doc's proposed grant list omitted the Phase 25 `theme` column (would break dark-mode persistence) and included an unused `display_name` self-grant.

---

## Self-editable column allowlist

| Option | Description | Selected |
|--------|-------------|----------|
| walkthrough + theme only | `GRANT UPDATE (walkthrough_completed, theme)`; smallest surface, matches exactly what the client writes; no self-rename | ✓ |
| + display_name | Also allow self-edit of `display_name` (new self-service rename, not currently used) | |

**User's choice:** walkthrough + theme only
**Notes:** `display_name` stays admin-set as today; self-rename deferred. `theme` is mandatory (Phase 25 `themeStore` writes it) — corrects the Urgent doc's `(walkthrough_completed, display_name)` proposal.

---

## Apply policy

| Option | Description | Selected |
|--------|-------------|----------|
| Migration + review + db push in-phase | Author migration, Codex review (D-046), `supabase db push` to prod within Phase 31; admin audit as authorized prod read | ✓ |
| Migration only, gate the push | Produce + review migration but defer prod apply to a separate explicit ship/urgent step | |

**User's choice:** Migration + review + db push in-phase
**Notes:** P0 live vector; standing authorization to apply migrations autonomously. Codex adversarial review mandatory either way (auth/schema → D-046).

---

## Claude's Discretion

- Defense-in-depth shape locked as Claude's-call (not asked — implementation depth): REVOKE from `authenticated`+`anon` → column-scoped GRANT → `BEFORE UPDATE` guard trigger on `role`/`is_active` exempting admin + service_role so `admin-update-user` keeps working; keep existing RLS policy.
- Trigger function name/schema, exact admin/service-role predicate, optional RLS `WITH CHECK` belt-and-suspenders, migration filename.

## Deferred Ideas

- Self-service `display_name` rename for specialists.
- Repo-wide `column_privileges` audit of other tables for the same over-broad-grant pattern.
- Column-restricting `WITH CHECK` on the RLS policy (optional; trigger covers it).
