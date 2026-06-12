import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// --- Mocks ---
const { mockUseAuthStore, mockFrom, mockNotifyError, mockIsFirebaseAuthBackend } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
  mockFrom: vi.fn(),
  mockNotifyError: vi.fn(),
  mockIsFirebaseAuthBackend: vi.fn(),
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock("../lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("../lib/authBackend", () => ({
  isFirebaseAuthBackend: mockIsFirebaseAuthBackend,
}));

vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({ notifyError: mockNotifyError }),
  },
}));

import { useUserRole } from "../hooks/useUserRole";

function asUser(id: string | null) {
  mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ user: id ? { id } : null }),
  );
}

// Build the .from('profiles').select('role').eq('id').maybeSingle() chain.
function setupProfileResponse(data: unknown, error: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}

function deferredProfileResponse() {
  let resolve!: (value: { data: unknown; error: unknown }) => void;
  const promise = new Promise<{ data: unknown; error: unknown }>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFirebaseAuthBackend.mockReturnValue(false);
  });

  it("returns isAdmin true when profile role is admin, no error signal", async () => {
    asUser("admin-1");
    setupProfileResponse({ role: "admin" }, null);

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe("admin");
    expect(result.current.error).toBe(false);
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("returns isAdmin false for not-admin (null role), NO error signal/notify", async () => {
    asUser("user-1");
    setupProfileResponse({ role: null }, null);

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.error).toBe(false);
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("fails closed on load error: isAdmin stays false AND the failure is signaled + surfaced (SC4/ASVS V4)", async () => {
    asUser("user-2");
    setupProfileResponse(null, { message: "boom" });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Fail closed — a load error must NEVER grant admin.
    expect(result.current.isAdmin).toBe(false);
    // Distinguish load-error from the not-admin null case.
    expect(result.current.error).toBe(true);
    // Surfaced via the toUserMessage funnel on a definite error. (The real store
    // dedupes identical messages per D-05, so a StrictMode double-mount collapses
    // to one toast — we assert it fired, not an exact count.)
    expect(mockNotifyError).toHaveBeenCalled();
    expect(mockNotifyError.mock.calls[0][0]).toBe("Something went wrong");
  });

  it("is loading initially (no notify while loading)", () => {
    asUser("user-3");
    setupProfileResponse({ role: "admin" }, null);

    const { result } = renderHook(() => useUserRole());

    expect(result.current.loading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("no user → not loading, not admin, no notify", () => {
    asUser(null);

    const { result } = renderHook(() => useUserRole());

    expect(result.current.loading).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.error).toBe(false);
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("WR-02: same-id token refresh (new user object) does not blank role or refetch", async () => {
    // A fresh user object with the SAME id (token refresh / onAuthStateChange
    // re-emit). Keying the effect on user?.id means no refetch and no flicker.
    let currentUser: { id: string } = { id: "admin-1" };
    mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ user: currentUser }),
    );
    setupProfileResponse({ role: "admin" }, null);

    const { result, rerender } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);

    // Replace the user object reference but keep the same id.
    currentUser = { id: "admin-1" };
    rerender();

    // Role stays resolved (no blank → no isAdmin flicker), and no refetch fires.
    expect(result.current.loading).toBe(false);
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("clears a loaded Supabase role synchronously when a different user id loads", async () => {
    let currentUser: { id: string } = { id: "admin-1" };
    mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ user: currentUser }),
    );

    const first = deferredProfileResponse();
    const second = deferredProfileResponse();
    const maybeSingle = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const { result, rerender } = renderHook(() => useUserRole());
    first.resolve({ data: { role: "admin" }, error: null });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe("admin");

    currentUser = { id: "specialist-1" };
    rerender();

    expect(result.current.loading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.role).toBeNull();

    second.resolve({ data: { role: "specialist" }, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.role).toBe("specialist");
  });

  it("uses Firebase custom claims without querying Supabase profiles", async () => {
    mockIsFirebaseAuthBackend.mockReturnValue(true);
    mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        user: {
          id: "firebase-admin",
          email: "admin@potomackco.com",
          claims: { role: "admin", is_active: true },
        },
      }),
    );

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe("admin");
    expect(result.current.isAdmin).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
