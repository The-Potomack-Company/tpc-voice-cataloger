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
import { Icon, type IconName } from "../ui/icons";

// Normalize :sessionId and :itemId into route templates so page_path aggregates cleanly.
function normalizePath(pathname: string): string {
  return pathname
    .replace(/\/session\/[^/]+\/item\/[^/]+/, "/session/:sessionId/item/:itemId")
    .replace(/\/session\/[^/]+/, "/session/:sessionId");
}

interface TabSpec {
  to: string;
  end?: boolean;
  icon: IconName;
  label: string;
}

const TABS: TabSpec[] = [
  { to: "/", end: true, icon: "folder", label: "Sessions" },
  { to: "/new", icon: "plus", label: "New" },
  { to: "/settings", icon: "settings", label: "Settings" },
];

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
      className="flex flex-col h-dvh bg-bg pt-[env(safe-area-inset-top)]"
    >
      <InstallBanner />
      <OfflineIndicator />
      <PhotoMigrationBanner />
      <main className="flex-1 overflow-y-auto isolate">
        {/* Phase 27 (MOTION-03): keyed wrapper triggers the route cross-fade
            declared in base.css. The keyframes are wrapped in a
            prefers-reduced-motion: no-preference media query, so users with
            the reduced-motion pref see instant transitions instead. */}
        <div
          key={location.pathname}
          className="tpc-route-fade-in"
          data-testid="route-fade"
        >
          <Outlet />
        </div>
      </main>
      <nav
        className="tpc-tabbar pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary navigation"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `tpc-tab ${isActive ? "tpc-tab-active" : ""}`
            }
            aria-label={tab.label}
          >
            {({ isActive }) => (
              <>
                <Icon name={tab.icon} size={22} aria-hidden />
                <span data-active={isActive ? "true" : "false"}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
