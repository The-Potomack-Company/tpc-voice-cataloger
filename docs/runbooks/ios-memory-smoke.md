# iOS Memory Smoke (Phase 34 / PERF-1)

Manual, two-part memory verification for the PWA on its iOS Safari target. This
is **intentionally not a CI test** (D-09): the only programmatic heap API,
`performance.measureUserAgentSpecificMemory()`, is Chromium-only **and** requires
the page to be cross-origin isolated (COOP/COEP headers). The TPC PWA is **not**
cross-origin isolated, so `measureUserAgentSpecificMemory` is unavailable on the
iOS Safari device — only the Web Inspector JS-heap timeline applies on-device.

The CI-side win for this phase is the render-count test (`src/tests/item-card-render-count.test.tsx`,
PERF-3 / D-08), which proves the fan-out reduction. This runbook covers the
memory side (PERF-1) that CI cannot reach.

## Part A — Desktop Chrome heap snapshot (bounded-growth check)

Goal: confirm the PERF-1 fix shows **bounded** heap growth across a recording
session, with no monotonic multi-MB-per-recording climb from retained binary
strings (the pre-fix base64 retention pattern).

1. Open the PWA in desktop Chrome. DevTools → **Memory** tab.
2. (Optional, Chromium only) If you serve the app behind COOP/COEP and want a
   programmatic number, run in the console:
   ```js
   await performance.measureUserAgentSpecificMemory();
   ```
   This requires cross-origin isolation; if `crossOriginIsolated` is `false` the
   call throws — fall back to the heap-snapshot procedure below.
3. Take a **heap snapshot** (baseline).
4. Run a **5-minute single-mode** recording / cataloging session: record several
   items, let audio upload, add a few photos in house mode.
5. Take a **second heap snapshot**.
6. Compare. Assert: total JS heap and retained "(string)" size grow **boundedly**,
   not linearly per recording. A monotonic multi-MB climb per recording indicates
   retained binary strings (regression of the PERF-1 fix).

## Part B — iOS Safari Web Inspector JS-heap timeline (real-device check)

Goal: real-device confirmation that the JS heap does not grow without bound and
the tab is not reloaded (OOM) mid-session.

1. On the Mac: Safari → Settings → Advanced → enable **Show Develop menu**.
2. On the iPhone: Settings → Safari → Advanced → enable **Web Inspector**.
3. Connect the iPhone via cable. Open the PWA on-device.
4. On the Mac: Safari → **Develop → <device> → <PWA tab>** to attach Web Inspector.
5. Open the **Timelines** tab, enable **JavaScript Allocations / Memory**, start recording.
6. Run the same 5-minute single-mode session on-device.
7. Stop the timeline. Assert: the JS-heap line trends flat/bounded after GC, with
   **no runaway growth** and **no tab reload** (a reload mid-session means the OS
   killed the tab for memory — an OOM, which is a failure).

> Caveat (verbatim intent): `performance.measureUserAgentSpecificMemory()` is
> Chromium-only and requires cross-origin isolation (COOP/COEP headers). The PWA
> is not cross-origin isolated, so that API is unavailable on the iOS Safari
> target — only the Web Inspector timeline applies on-device.

## Related

- Phase 34 — iOS Memory Optimization (PERF-1 base64 streaming; PERF-3 render fan-out).
- D-08: render-count test is the CI-testable win.
- D-09: this memory smoke is manual, not CI.
