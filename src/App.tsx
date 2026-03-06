import { Routes, Route } from "react-router";
import { AppLayout } from "./layouts/AppLayout";
import { SessionsPage } from "./pages/Sessions";
import { NewSessionPage } from "./pages/NewSession";
import { SessionDetailPage } from "./pages/SessionDetail";
import { ItemEntryPage } from "./pages/ItemEntry";
import { SettingsPage } from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<SessionsPage />} />
        <Route path="new" element={<NewSessionPage />} />
        <Route path="session/:sessionId" element={<SessionDetailPage />} />
        <Route path="session/:sessionId/item/:itemId" element={<ItemEntryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
