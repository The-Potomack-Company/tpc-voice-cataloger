import { useState, useEffect, useCallback, useRef } from "react";
import { needsMigration, migrateToSupabase } from "../db/migration";

type MigrationState =
  | "checking"
  | "not-needed"
  | "in-progress"
  // SC3/D-07: a run that skipped ≥1 item is NOT "complete". Distinguishing
  // "partial" here is what stops the splash from claiming full success — the
  // catch below still owns thrown failures; "partial" is a success-path outcome.
  | "partial"
  | "complete"
  | "error";

interface MigrationStatus {
  state: MigrationState;
  current: number;
  total: number;
  migrated: number;
  alreadyMigrated: number;
  failed: number;
}

export function useDataMigration(userId: string | undefined) {
  const [status, setStatus] = useState<MigrationStatus>({
    state: "checking",
    current: 0,
    total: 0,
    migrated: 0,
    alreadyMigrated: 0,
    failed: 0,
  });

  // CR-01: re-entrancy guard. setStatus("in-progress") is async, so a second
  // synchronous runMigration() (e.g. a double-clicked splash Retry) would fall
  // straight through to a SECOND concurrent migrateToSupabase before the first
  // wrote any idMapping — both read a null mapping and both insert, defeating
  // the check-then-insert idempotency and duplicating the Supabase session/items.
  // A ref flips synchronously so the second call is rejected in the same tick.
  // (A ref suffices: both stores are single-tab IndexedDB; cross-tab is out of v1.)
  const runningRef = useRef(false);

  const runMigration = useCallback(async () => {
    if (!userId || runningRef.current) return;
    runningRef.current = true;
    setStatus((s) => ({ ...s, state: "in-progress" }));
    try {
      const result = await migrateToSupabase(userId, (current, total) => {
        setStatus((s) => ({ ...s, current, total }));
      });
      setStatus((s) => ({
        ...s,
        state: result.partial ? "partial" : "complete",
        migrated: result.migrated,
        // D-10: surface the failed/alreadyMigrated split so MigrationRetryBanner
        // can show the failed-only "N" while idempotent skips stay invisible.
        alreadyMigrated: result.alreadyMigrated,
        failed: result.failed,
      }));
    } catch {
      setStatus((s) => ({ ...s, state: "error" }));
    } finally {
      runningRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    needsMigration().then((needed) => {
      if (needed) {
        runMigration();
      } else {
        setStatus((s) => ({ ...s, state: "not-needed" }));
      }
    });
  }, [userId, runMigration]);

  return { ...status, retry: runMigration };
}
