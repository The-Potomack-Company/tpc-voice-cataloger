import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetFirebaseAuthForTests,
  roleFromFirebaseClaims,
  setFirebaseSdkLoaderForTests,
  signInWithGoogle,
} from "../lib/firebaseAuth";

function stubFirebaseEnv() {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "api-key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "gen-lang-client-0662587427.firebaseapp.com");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "gen-lang-client-0662587427");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "gen-lang-client-0662587427.firebasestorage.app");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:tpc-hub");
}

describe("firebaseAuth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetFirebaseAuthForTests();
    stubFirebaseEnv();
  });

  it("maps role claims and only falls back to specialist for Potomack emails", () => {
    expect(
      roleFromFirebaseClaims({
        id: "1",
        email: "admin@potomackco.com",
        claims: { role: "admin", is_active: true },
      }),
    ).toBe("admin");
    expect(
      roleFromFirebaseClaims({
        id: "2",
        email: "staff@potomackco.com",
        claims: {
          email_verified: true,
          hd: "potomackco.com",
          firebase: { sign_in_provider: "google.com" },
        },
      }),
    ).toBe("specialist");
    expect(
      roleFromFirebaseClaims({
        id: "2b",
        email: "staff@potomackco.com",
        claims: { email_verified: false, hd: "potomackco.com" },
      }),
    ).toBeNull();
    expect(
      roleFromFirebaseClaims({
        id: "3",
        email: "admin@potomackco.com",
        claims: { role: "admin", is_active: false },
      }),
    ).toBeNull();
    expect(
      roleFromFirebaseClaims({
        id: "4",
        email: "outsider@example.com",
        claims: {},
      }),
    ).toBeNull();
  });

  it("uses Google popup with hd and returns a Firebase app session", async () => {
    const setCustomParameters = vi.fn();
    const signInWithPopup = vi.fn().mockResolvedValue({
      user: {
        uid: "firebase-1",
        email: "staff@potomackco.com",
        displayName: "Staff User",
        getIdToken: vi.fn().mockResolvedValue("fallback-token"),
        getIdTokenResult: vi.fn().mockResolvedValue({
          token: "id-token",
          claims: {
            role: "specialist",
            email_verified: true,
            hd: "potomackco.com",
            firebase: { sign_in_provider: "google.com" },
          },
        }),
      },
    });
    const auth = {};
    setFirebaseSdkLoaderForTests(async () => ({
      initializeApp: vi.fn(() => ({})),
      getApps: vi.fn(() => []),
      getApp: vi.fn(() => ({})),
      getAuth: vi.fn(() => auth),
      GoogleAuthProvider: class {
        setCustomParameters = setCustomParameters;
      },
      onAuthStateChanged: vi.fn(),
      signInWithPopup,
      signOut: vi.fn(),
      updatePassword: vi.fn(),
    }));

    const session = await signInWithGoogle();

    expect(setCustomParameters).toHaveBeenCalledWith({
      hd: "potomackco.com",
      prompt: "select_account",
    });
    expect(signInWithPopup).toHaveBeenCalled();
    expect(session.access_token).toBe("id-token");
    expect(session.user.id).toBe("firebase-1");
  });

  it("signs out and rejects users outside the Potomack domain", async () => {
    const signOut = vi.fn();
    setFirebaseSdkLoaderForTests(async () => ({
      initializeApp: vi.fn(() => ({})),
      getApps: vi.fn(() => []),
      getApp: vi.fn(() => ({})),
      getAuth: vi.fn(() => ({})),
      GoogleAuthProvider: class {
        setCustomParameters = vi.fn();
      },
      onAuthStateChanged: vi.fn(),
      signInWithPopup: vi.fn().mockResolvedValue({
        user: {
          uid: "firebase-2",
          email: "person@example.com",
          displayName: "Outside User",
          getIdToken: vi.fn().mockResolvedValue("fallback-token"),
          getIdTokenResult: vi.fn().mockResolvedValue({
            token: "id-token",
            claims: { hd: "example.com" },
          }),
        },
      }),
      signOut,
      updatePassword: vi.fn(),
    }));

    await expect(signInWithGoogle()).rejects.toThrow("outside the allowed Google Workspace domain");
    expect(signOut).toHaveBeenCalled();
  });

  it("signs out and rejects unverified Potomack email accounts", async () => {
    const signOut = vi.fn();
    setFirebaseSdkLoaderForTests(async () => ({
      initializeApp: vi.fn(() => ({})),
      getApps: vi.fn(() => []),
      getApp: vi.fn(() => ({})),
      getAuth: vi.fn(() => ({})),
      GoogleAuthProvider: class {
        setCustomParameters = vi.fn();
      },
      onAuthStateChanged: vi.fn(),
      signInWithPopup: vi.fn().mockResolvedValue({
        user: {
          uid: "firebase-3",
          email: "staff@potomackco.com",
          displayName: "Unverified User",
          getIdToken: vi.fn().mockResolvedValue("fallback-token"),
          getIdTokenResult: vi.fn().mockResolvedValue({
            token: "id-token",
            claims: {
              email_verified: false,
              hd: "potomackco.com",
              firebase: { sign_in_provider: "google.com" },
            },
          }),
        },
      }),
      signOut,
      updatePassword: vi.fn(),
    }));

    await expect(signInWithGoogle()).rejects.toThrow("outside the allowed Google Workspace domain");
    expect(signOut).toHaveBeenCalled();
  });

  it("signs out and rejects non-Google Potomack email accounts", async () => {
    const signOut = vi.fn();
    setFirebaseSdkLoaderForTests(async () => ({
      initializeApp: vi.fn(() => ({})),
      getApps: vi.fn(() => []),
      getApp: vi.fn(() => ({})),
      getAuth: vi.fn(() => ({})),
      GoogleAuthProvider: class {
        setCustomParameters = vi.fn();
      },
      onAuthStateChanged: vi.fn(),
      signInWithPopup: vi.fn().mockResolvedValue({
        user: {
          uid: "firebase-4",
          email: "staff@potomackco.com",
          displayName: "Password User",
          getIdToken: vi.fn().mockResolvedValue("fallback-token"),
          getIdTokenResult: vi.fn().mockResolvedValue({
            token: "id-token",
            claims: {
              email_verified: true,
              hd: "potomackco.com",
              firebase: { sign_in_provider: "password" },
            },
          }),
        },
      }),
      signOut,
      updatePassword: vi.fn(),
    }));

    await expect(signInWithGoogle()).rejects.toThrow("outside the allowed Google Workspace domain");
    expect(signOut).toHaveBeenCalled();
  });
});
