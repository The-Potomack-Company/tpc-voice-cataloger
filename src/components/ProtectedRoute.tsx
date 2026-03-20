import { useEffect, useState } from 'react';
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
      setScoped(true);
    }
  }, [user?.id]);

  // Run migration after scoping
  const migration = useDataMigration(scoped ? user?.id : undefined);

  // Drain write-ahead queue first, then fetch sessions from server
  useEffect(() => {
    if (migration.state === 'complete' || migration.state === 'not-needed') {
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

  // Show migration splash if migration is in progress, complete (before auto-dismiss), or errored
  if (migration.state === 'in-progress' || migration.state === 'checking' ||
      (migration.state === 'complete' && !migrationDismissed) ||
      (migration.state === 'error' && !migrationDismissed)) {
    return (
      <>
        {(migration.state === 'in-progress' || migration.state === 'complete' || migration.state === 'error') && (
          <MigrationSplash
            state={migration.state}
            current={migration.current}
            total={migration.total}
            skipped={migration.skipped}
            onRetry={migration.retry}
            onSkip={() => setMigrationDismissed(true)}
            onComplete={() => setMigrationDismissed(true)}
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

  return <Outlet />;
}
