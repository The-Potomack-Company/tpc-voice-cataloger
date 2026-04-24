import { useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import { InstallBanner } from "../components/InstallBanner";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { drainQueue } from "../services/offlineQueue";
import { drainPhotoQueue } from "../services/photoUploadQueue";
import { migrateExistingPhotos } from "../services/photoMigration";
import { PhotoMigrationBanner } from "../components/PhotoMigrationBanner";
import {
  useWriteAheadQueue,
  processWriteAheadQueue,
} from "../hooks/useWriteAheadQueue";
import { useSessionStore } from "../stores/sessionStore";
import { trackUiInteraction } from "../services/analytics";

// Normalize :sessionId and :itemId into route templates so page_path aggregates cleanly.
function normalizePath(pathname: string): string {
  return pathname
    .replace(/\/session\/[^/]+\/item\/[^/]+/, "/session/:sessionId/item/:itemId")
    .replace(/\/session\/[^/]+/, "/session/:sessionId");
}

function tabClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-col items-center py-3 px-4 min-h-12 min-w-12 transition-colors ${
    isActive ? "text-accent" : "text-gray-500 dark:text-gray-400"
  }`;
}

export function AppLayout() {
  useOnlineStatus();
  useWriteAheadQueue();

  const location = useLocation();
  const fetchSessions = useSessionStore(s => s.fetchSessions);

  useEffect(() => {
    const template = normalizePath(location.pathname);
    const sessionMatch = location.pathname.match(/\/session\/([^/]+)/);
    trackUiInteraction({
      interaction_type: "view",
      page_path: template,
      session_id: sessionMatch?.[1] ?? null,
      metadata: { raw_path: location.pathname },
    });
  }, [location.pathname]);

  useEffect(() => {
    const handleReconnect = async () => {
      await processWriteAheadQueue(); // Write-ahead first (items must exist before AI can update)
      await fetchSessions(); // Re-fetch after queue drains so server data includes synced items
      await drainPhotoQueue(); // Photos after metadata synced
      drainQueue(); // Audio last
    };
    // Drain on mount if online (handles case: app closed with queued items, reopened with connectivity)
    if (navigator.onLine) {
      handleReconnect();
    }
    // Run photo migration on mount (post-auth, non-blocking)
    migrateExistingPhotos().catch(() => {});
    const handleOnline = () => handleReconnect();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchSessions]);

  return (
    <div
      data-testid="app-layout"
      className="flex flex-col h-dvh bg-white dark:bg-gray-900 pt-[env(safe-area-inset-top)]"
    >
      <InstallBanner />
      <OfflineIndicator />
      <PhotoMigrationBanner />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav
        className="flex items-center justify-around border-t border-gray-200 dark:border-gray-700
                   bg-white dark:bg-gray-900 pb-[env(safe-area-inset-bottom)]"
      >
        <NavLink to="/" end className={tabClass}>
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          <span className="text-xs mt-1">Sessions</span>
        </NavLink>
        <NavLink to="/new" className={tabClass}>
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-xs mt-1">New</span>
        </NavLink>
        <NavLink to="/settings" className={tabClass}>
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-xs mt-1">Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
