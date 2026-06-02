import { useState, useEffect, useCallback } from "react";
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

  const runMigration = useCallback(async () => {
    if (!userId) return;
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
