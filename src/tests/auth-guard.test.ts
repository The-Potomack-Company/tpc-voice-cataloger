import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockIsFirebaseAuthBackend,
  mockGetFreshFirebaseIdToken,
  mockGetSession,
  mockRefreshSession,
} = vi.hoisted(() => ({
  mockIsFirebaseAuthBackend: vi.fn(),
  mockGetFreshFirebaseIdToken: vi.fn(),
  mockGetSession: vi.fn(),
  mockRefreshSession: vi.fn(),
}));

vi.mock("../lib/authBackend", () => ({
  isFirebaseAuthBackend: mockIsFirebaseAuthBackend,
}));

vi.mock("../lib/firebaseAuth", () => ({
  getFreshFirebaseIdToken: mockGetFreshFirebaseIdToken,
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  },
}));

import { ensureFreshSession } from "../lib/authGuard";

describe("ensureFreshSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFirebaseAuthBackend.mockReturnValue(false);
  });

  it("returns a forced fresh Firebase ID token on the Firebase auth backend", async () => {
    mockIsFirebaseAuthBackend.mockReturnValue(true);
    mockGetFreshFirebaseIdToken.mockResolvedValue("fresh-firebase-id-token");

    await expect(ensureFreshSession()).resolves.toBe("fresh-firebase-id-token");

    expect(mockGetFreshFirebaseIdToken).toHaveBeenCalledOnce();
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("uses Supabase session refresh on the Supabase auth backend", async () => {
    mockGetSession
      .mockResolvedValueOnce({
        data: {
          session: {
            expires_at: Math.floor(Date.now() / 1000) + 30,
            access_token: "stale-supabase-token",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          session: {
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            access_token: "fresh-supabase-token",
          },
        },
      });
    mockRefreshSession.mockResolvedValue({ data: { session: {} }, error: null });

    await expect(ensureFreshSession()).resolves.toBe("fresh-supabase-token");

    expect(mockRefreshSession).toHaveBeenCalledOnce();
    expect(mockGetFreshFirebaseIdToken).not.toHaveBeenCalled();
  });
});
