# Phase 44 — Deferred Items

Source: 44-REVIEW.md. WR-01 was fixed in-phase (commit follows); the items below
are deferred as out-of-scope or pre-existing behavior.

## WR-02 (deferred): blocked badge silently disappears on `fetchBlockedItems` query error

`fetchBlockedItems` returns `[]` on a backend query error, so the blocked-work safety
badge vanishes when the backend is flaky — the opposite of its "no longer strands
silently" purpose. The fix touches the fetch/store error-handling path, not the
phase-44 display/nav scope. Fold into a future reliability pass on the blocked-queue
data source.

## IN-01 (deferred): `mode === "sale" ? "Sale" : "House"` mislabels non-sale modes as House

`mode` is an untyped `string` at the badge boundary; any value other than `"sale"`
renders "House". In practice `mode` is `"house" | "sale"`, so impact is nil today.
Tighten the type or use an explicit map when the badge data source is revisited.

## IN-02 (deferred): best-effort import rollback is invisible on partial cleanup failure

The compensating reverse-order deletes in `NewSession.handleImport` are best-effort
(`.catch(() => {})`); a failed cleanup leaves orphan rows with no surfaced signal. The
"no orphan rows remain" comment is aspirational. A transactional import RPC (D-01's
noted alternative) would close this — out of scope for a copy/nav phase.
