import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignInWithGoogle, mockSignOutFirebase, mockUpdateFirebasePassword } = vi.hoisted(() => ({
  mockSignInWithGoogle: vi.fn(),
  mockSignOutFirebase: vi.fn(),
  mockUpdateFirebasePassword: vi.fn(),
}));

vi.mock("../lib/authBackend", () => ({
  isFirebaseAuthBackend: () => true,
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(() => ({ insert: vi.fn() })),
  },
}));

vi.mock("../services/analytics", () => ({
  trackEvent: vi.fn(),
  trackEventNow: vi.fn(),
}));

vi.mock("../lib/firebaseAuth", async () => {
  const actual = await vi.importActual<typeof import("../lib/firebaseAuth")>("../lib/firebaseAuth");
  return {
    ...actual,
    signInWithGoogle: mockSignInWithGoogle,
    signOutFirebase: mockSignOutFirebase,
    updateFirebasePassword: mockUpdateFirebasePassword,
    subscribeToFirebaseAuth: vi.fn(() => vi.fn()),
  };
});

describe("authStore Firebase backend", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useAuthStore } = await import("../stores/authStore");
    useAuthStore.setState({ session: null, user: null, loading: true });
  });

  it("signIn uses Google popup and stores the Firebase session", async () => {
    const session = {
      access_token: "firebase-token",
      provider: "firebase" as const,
      user: {
        id: "firebase-user",
        email: "staff@potomackco.com",
        claims: { role: "specialist" },
      },
    };
    mockSignInWithGoogle.mockResolvedValueOnce(session);
    const { useAuthStore } = await import("../stores/authStore");

    const result = await useAuthStore.getState().signIn();

    expect(result).toEqual({ error: null });
    expect(mockSignInWithGoogle).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().session).toEqual(session);
    expect(useAuthStore.getState().user).toEqual(session.user);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it("signOut clears Firebase session state", async () => {
    const { useAuthStore } = await import("../stores/authStore");
    useAuthStore.setState({
      session: {
        access_token: "firebase-token",
        provider: "firebase",
        user: { id: "firebase-user", email: "staff@potomackco.com" },
      },
      user: { id: "firebase-user", email: "staff@potomackco.com" },
      loading: false,
    });

    await useAuthStore.getState().signOut();

    expect(mockSignOutFirebase).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
