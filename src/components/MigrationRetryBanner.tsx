import { useState } from "react";
import { useOutletContext } from "react-router";
import { WarnBanner } from "../ui/WarnBanner";
import type { useDataMigration } from "../hooks/useDataMigration";

// D-07/T-38-04: reads the SINGLE shared migration hook instance from
// ProtectedRoute's <Outlet context={migration} /> — it must NEVER call
// useDataMigration or useLiveQuery itself, or a second instance would spawn a
// parallel migration. Copy is locked by 38-UI-SPEC §Copywriting.
export function MigrationRetryBanner() {
  const m = useOutletContext<ReturnType<typeof useDataMigration> | null>();
  const [dismissed, setDismissed] = useState(false);

  // D-10: N = failed only; null-render mirrors PhotoMigrationBanner. The guard
  // narrows state to "partial", so an in-flight retry (state "in-progress") hides
  // this banner entirely — the at-login MigrationSplash owns the busy UI (D-08).
  // The "Retrying…" label thus never shows here; we keep the locked "Retry sync"
  // CTA and leave busy false (the WarnBanner action slot honors busy generically).
  // `m` is null when AppLayout renders outside ProtectedRoute's context Outlet
  // (e.g. isolated layout tests) — render nothing rather than throw.
  if (!m || m.state !== "partial" || dismissed || m.failed === 0) return null;

  return (
    <WarnBanner
      title={`${m.failed} item${m.failed === 1 ? "" : "s"} not yet synced`}
      body="Your data is safe — retry to finish syncing."
      onDismiss={() => setDismissed(true)}
      action={{ label: "Retry sync", onClick: m.retry }}
    />
  );
}
