import { useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import { InstallBanner } from "../components/InstallBanner";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { BlockedQueueBadge } from "../components/BlockedQueueBadge";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { drainQueue } from "../services/offlineQueue";
import { drainPhotoQueue } from "../services/photoUploadQueue";
import { drainAudioQueue, resweepFailedUploads } from "../services/audioUploadQueue";
import { migrateExistingPhotos } from "../services/photoMigration";
import { PhotoMigrationBanner } from "../components/PhotoMigrationBanner";
import { MigrationRetryBanner } from "../components/MigrationRetryBanner";
import { ErrorToast } from "../components/ErrorToast";
import {
  useWriteAheadQueue,
  processWriteAheadQueue,
} from "../hooks/useWriteAheadQueue";
import { useSessionStore } from "../stores/sessionStore";
import { trackUiInteraction } from "../services/analytics";
import { Icon, type IconName } from "../ui/icons";
import { Badge } from "../ui/Badge";
import { useUserRole } from "../hooks/useUserRole";

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
  activeFor?: (pathname: string) => boolean;
}

function roleLabel(role: string | null, isAdmin: boolean, isReviewer: boolean): string {
  if (role === "dev") return "Dev";
  if (isAdmin) return "Admin";
  if (isReviewer) return "Manager";
  return "Specialist";
}

export function AppLayout() {
  useOnlineStatus();
  useWriteAheadQueue();

  const location = useLocation();
  const fetchSessions = useSessionStore(s => s.fetchSessions);
  const { role, isAdmin, isReviewer } = useUserRole();
  const roleName = roleLabel(role, isAdmin, isReviewer);
  const tabs: TabSpec[] = [
    {
      to: "/",
      end: true,
      icon: "home",
      label: roleName === "Specialist" ? "Home" : "Home",
      activeFor: (pathname) => pathname === "/",
    },
    {
      to: "/",
      icon: "folder",
      label: roleName === "Dev" ? "Analytics" : "Catalog",
      activeFor: (pathname) =>
        pathname.startsWith("/session") || pathname === "/new",
    },
    ...(roleName === "Specialist" || isAdmin
      ? [{ to: "/new", icon: "plus" as IconName, label: "New" }]
      : []),
    ...(isAdmin
      ? [{ to: "/admin/accounts", icon: "users" as IconName, label: "Accounts" }]
      : []),
    { to: "/settings", icon: "settings", label: "Setup" },
  ];

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
      void resweepFailedUploads(); // SC-1: bounded failed→pending self-heal (fires its own drain); boot + every 'online'
      void drainAudioQueue(); // Audio uploads — resume any pending blobs stranded by app close / offline record
      drainQueue(); // AI offline write queue last
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
      className="tpc-app-shell bg-bg pt-[env(safe-area-inset-top)]"
    >
      <InstallBanner />
      <PhotoMigrationBanner />
      <MigrationRetryBanner />
      <nav
        className="tpc-rail pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary navigation"
      >
        <div className="tpc-rail-mark" aria-hidden>
          TPC
        </div>
        {tabs.map((tab) => (
          <NavLink
            key={`${tab.to}:${tab.label}`}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `tpc-rail-tab ${(
                tab.activeFor ? tab.activeFor(location.pathname) : isActive
              ) ? "tpc-rail-tab-active" : ""}`
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
      <div className="tpc-main">
        <header className="tpc-topbar">
          <div className="tpc-brandline">
            <span className="tpc-eyebrow">The Potomack Co.</span>
            <strong className="tpc-display tpc-shell-title">
              {location.pathname.startsWith("/admin")
                ? "Accounts"
                : location.pathname.startsWith("/settings")
                  ? "Setup"
                  : location.pathname.startsWith("/session")
                    ? "Catalog"
                    : "Sessions"}
            </strong>
          </div>
          <div className="tpc-topbar-actions">
            <Badge tone={roleName === "Specialist" ? "info" : "default"}>
              {roleName}
            </Badge>
            <OfflineIndicator />
            <BlockedQueueBadge />
          </div>
        </header>
        <main className="tpc-content">
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
      </div>
      <ErrorToast />
    </div>
  );
}
