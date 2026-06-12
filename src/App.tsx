import { Routes, Route } from "react-router";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRouteGuard } from "./components/AdminRouteGuard";
import { LoginPage } from "./pages/Login";
import { SessionsPage } from "./pages/Sessions";
import { NewSessionPage } from "./pages/NewSession";
import { SessionDetailPage } from "./pages/SessionDetail";
import { PhotoNotesPage } from "./pages/PhotoNotes";
import { ReviewQueuePage } from "./pages/ReviewQueue";
import { ItemEntryPage } from "./pages/ItemEntry";
import { SettingsPage } from "./pages/Settings";
import { AccountManagementPage } from "./pages/AccountManagement";
import { featureFlags } from "./lib/featureFlags";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<SessionsPage />} />
          <Route path="new" element={<NewSessionPage />} />
          <Route path="session/:sessionId" element={<SessionDetailPage />} />
          {featureFlags.photoNotes && (
            <>
              <Route
                path="session/:sessionId/photo-notes"
                element={<PhotoNotesPage />}
              />
              <Route
                path="session/:sessionId/review-drafts"
                element={<ReviewQueuePage />}
              />
            </>
          )}
          <Route
            path="session/:sessionId/item/:itemId"
            element={<ItemEntryPage />}
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<AdminRouteGuard />}>
            <Route path="admin/accounts" element={<AccountManagementPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
