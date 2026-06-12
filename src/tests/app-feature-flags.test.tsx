import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router";
import App from "../App";

vi.mock("../components/ProtectedRoute", () => ({
  ProtectedRoute: () => <Outlet />,
}));
vi.mock("../components/AdminRouteGuard", () => ({
  AdminRouteGuard: () => <Outlet />,
}));
vi.mock("../layouts/AppLayout", () => ({
  AppLayout: () => <Outlet />,
}));
vi.mock("../pages/Login", () => ({ LoginPage: () => <div>LOGIN</div> }));
vi.mock("../pages/Sessions", () => ({ SessionsPage: () => <div>SESSIONS</div> }));
vi.mock("../pages/NewSession", () => ({ NewSessionPage: () => <div>NEW SESSION</div> }));
vi.mock("../pages/SessionDetail", () => ({ SessionDetailPage: () => <div>SESSION DETAIL</div> }));
vi.mock("../pages/PhotoNotes", () => ({ PhotoNotesPage: () => <div>PHOTO NOTES ROUTE</div> }));
vi.mock("../pages/ReviewQueue", () => ({ ReviewQueuePage: () => <div>REVIEW DRAFTS ROUTE</div> }));
vi.mock("../pages/ItemEntry", () => ({ ItemEntryPage: () => <div>ITEM ENTRY</div> }));
vi.mock("../pages/Settings", () => ({ SettingsPage: () => <div>SETTINGS</div> }));
vi.mock("../pages/AccountManagement", () => ({
  AccountManagementPage: () => <div>ACCOUNTS</div>,
}));

describe("App feature flags", () => {
  afterEach(() => {
    vi.stubEnv("VITE_FEATURE_PHOTO_NOTES", "true");
  });

  it("does not register the photo notes route when the flag is off", () => {
    vi.stubEnv("VITE_FEATURE_PHOTO_NOTES", "false");
    render(
      <MemoryRouter initialEntries={["/session/session-1/photo-notes"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByText("PHOTO NOTES ROUTE")).not.toBeInTheDocument();
  });

  it("does not register the review drafts route when the flag is off", () => {
    vi.stubEnv("VITE_FEATURE_PHOTO_NOTES", "false");
    render(
      <MemoryRouter initialEntries={["/session/session-1/review-drafts"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByText("REVIEW DRAFTS ROUTE")).not.toBeInTheDocument();
  });
});
