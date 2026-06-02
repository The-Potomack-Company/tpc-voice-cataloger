import { useCallback, useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore, scopeSessionStore } from '../stores/sessionStore';
import { scopeUIStore } from '../stores/uiStore';
import { useDataMigration } from '../hooks/useDataMigration';
import { processWriteAheadQueue } from '../hooks/useWriteAheadQueue';
import { MigrationSplash } from './MigrationSplash';

export function ProtectedRoute() {
  const { session, user, loading: authLoading } = useAuthStore();
  const fetchSessions = useSessionStore(s => s.fetchSessions);
  const [scoped, setScoped] = useState(false);
  const [migrationDismissed, setMigrationDismissed] = useState(false);

  // Scope stores to user on login
  useEffect(() => {
    if (user?.id) {
      scopeUIStore(user.id);
      scopeSessionStore(user.id);
      queueMicrotask(() => setScoped(true));
    }
  }, [user?.id]);

  // Run migration after scoping
  const migration = useDataMigration(scoped ? user?.id : undefined);

  // WR-03: MigrationSplash's auto-dismiss effect depends on onComplete. A fresh
  // inline arrow each render would restart its 1500/1800ms timers on any parent
  // re-render during that window. Stabilize the handlers so the splash dismisses
  // on schedule regardless of re-render churn.
  const dismissMigration = useCallback(() => setMigrationDismissed(true), []);

  // Drain write-ahead queue first, then fetch sessions from server
  useEffect(() => {
    // WR-01: 'partial' is a terminal state that hands control to the app (the
    // splash auto-dismisses to <Outlet />). It must drain the write-ahead queue
    // and fetch sessions like 'complete'/'not-needed', or the user lands on a
    // stale list with un-drained queued writes. The 'error'/skip path is left
    // out deliberately: the user hasn't accepted the data state there, and skip
    // keeps them on whatever was already loaded.
    if (['complete', 'not-needed', 'partial'].includes(migration.state)) {
      processWriteAheadQueue().then(() => fetchSessions());
    }
  }, [migration.state, fetchSessions]);

  if (authLoading) {
    return <div data-testid="auth-loading" className="flex items-center justify-center h-dvh">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
    </div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Show migration splash if migration is in progress, complete/partial (before
  // auto-dismiss), or errored. SC3/D-07: "partial" must reach the splash so the
  // honest partial copy actually renders — otherwise the partial state is dead code.
  if (migration.state === 'in-progress' || migration.state === 'checking' ||
      (migration.state === 'complete' && !migrationDismissed) ||
      (migration.state === 'partial' && !migrationDismissed) ||
      (migration.state === 'error' && !migrationDismissed)) {
    return (
      <>
        {(migration.state === 'in-progress' || migration.state === 'complete' || migration.state === 'partial' || migration.state === 'error') && (
          <MigrationSplash
            state={migration.state}
            current={migration.current}
            total={migration.total}
            skipped={migration.failed}
            onRetry={migration.retry}
            onSkip={dismissMigration}
            onComplete={dismissMigration}
          />
        )}
        {migration.state === 'checking' && (
          <div className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        )}
      </>
    );
  }

  // D-07: share the single migration hook instance down to AppLayout's
  // MigrationRetryBanner via Outlet context — prevents a second useDataMigration
  // call (which would spawn a parallel migration, T-38-04).
  return <Outlet context={migration} />;
}
