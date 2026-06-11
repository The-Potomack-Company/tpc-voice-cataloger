import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFreshFirebaseIdToken,
  resetFirebaseAuthForTests,
  roleFromFirebaseClaims,
  setFirebaseSdkLoaderForTests,
  signInWithGoogle,
  type FirebaseClaims,
} from "../lib/firebaseAuth";

function stubFirebaseEnv() {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "api-key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "gen-lang-client-0662587427.firebaseapp.com");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "gen-lang-client-0662587427");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "gen-lang-client-0662587427.firebasestorage.app");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:tpc-hub");
}

function firebaseUser({
  uid = "firebase-1",
  email = "staff@potomackco.com",
  displayName = "Staff User",
  token = "id-token",
  claims,
}: {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  token?: string;
  claims?: FirebaseClaims;
} = {}) {
  return {
    uid,
    email,
    displayName,
    getIdToken: vi.fn().mockResolvedValue("fallback-token"),
    getIdTokenResult: vi.fn().mockResolvedValue({
      token,
      claims: claims ?? {
        email,
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
      },
    }),
  };
}

function installFirebaseSdk({
  auth = {},
  popupUser = firebaseUser(),
  omitProfileHd = false,
  profileHd = "potomackco.com",
  signOut = vi.fn(),
}: {
  auth?: unknown;
  popupUser?: ReturnType<typeof firebaseUser>;
  omitProfileHd?: boolean;
  profileHd?: string | undefined;
  signOut?: ReturnType<typeof vi.fn>;
} = {}) {
  const result = { user: popupUser };
  const setCustomParameters = vi.fn();
  const signInWithPopup = vi.fn().mockResolvedValue(result);
  const getAdditionalUserInfo = vi.fn(() => ({
    profile: omitProfileHd ? {} : { hd: profileHd },
  }));

  setFirebaseSdkLoaderForTests(async () => ({
    initializeApp: vi.fn(() => ({})),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => ({})),
    getAuth: vi.fn(() => auth),
    GoogleAuthProvider: class {
      setCustomParameters = setCustomParameters;
    },
    getAdditionalUserInfo,
    onAuthStateChanged: vi.fn(),
    signInWithPopup,
    signOut,
    updatePassword: vi.fn(),
  }));

  return { getAdditionalUserInfo, result, setCustomParameters, signInWithPopup, signOut };
}

describe("firebaseAuth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetFirebaseAuthForTests();
    stubFirebaseEnv();
  });

  it("maps role claims and falls back to specialist without requiring hd in Firebase claims", () => {
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
          firebase: { sign_in_provider: "google.com" },
        },
      }),
    ).toBe("specialist");
    expect(
      roleFromFirebaseClaims({
        id: "2a",
        email: "staff@potomackco.com",
        claims: { email_verified: false, firebase: { sign_in_provider: "google.com" } },
      }),
    ).toBeNull();
    expect(
      roleFromFirebaseClaims({
        id: "2b",
        email: "staff@potomackco.com",
        claims: { email_verified: true, firebase: { sign_in_provider: "password" } },
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

  it("uses Google popup with hd and returns a Firebase app session when raw profile hd is correct", async () => {
    const { getAdditionalUserInfo, result, setCustomParameters, signInWithPopup } =
      installFirebaseSdk();

    const session = await signInWithGoogle();

    expect(setCustomParameters).toHaveBeenCalledWith({
      hd: "potomackco.com",
      prompt: "select_account",
    });
    expect(signInWithPopup).toHaveBeenCalled();
    expect(getAdditionalUserInfo).toHaveBeenCalledWith(result);
    expect(session.access_token).toBe("id-token");
    expect(session.user.id).toBe("firebase-1");
  });

  it("rejects and signs out when Google raw profile hd is missing", async () => {
    const { signOut } = installFirebaseSdk({ omitProfileHd: true });

    await expect(signInWithGoogle()).rejects.toThrow(
      "Please use your Potomack Workspace account",
    );
    expect(signOut).toHaveBeenCalled();
  });

  it("rejects and signs out when Google raw profile hd is mismatched", async () => {
    const { signOut } = installFirebaseSdk({ profileHd: "example.com" });

    await expect(signInWithGoogle()).rejects.toThrow(
      "Please use your Potomack Workspace account",
    );
    expect(signOut).toHaveBeenCalled();
  });

  it("accepts refreshed Firebase claims for a vetted user without requiring hd", async () => {
    const currentUser = firebaseUser({
      uid: "firebase-no-hd",
      token: "fresh-token",
      claims: {
        email: "staff@potomackco.com",
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
      },
    });
    const auth = { currentUser };
    const { signOut } = installFirebaseSdk({ auth });

    await expect(getFreshFirebaseIdToken()).resolves.toBe("fresh-token");
    expect(currentUser.getIdTokenResult).toHaveBeenCalledWith(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out and rejects refreshed users outside the Potomack domain", async () => {
    const currentUser = firebaseUser({
      uid: "firebase-stale",
      email: "staff@example.com",
      claims: {
        email: "staff@example.com",
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
      },
    });
    const auth = { currentUser };
    const { signOut } = installFirebaseSdk({ auth });

    await expect(getFreshFirebaseIdToken()).rejects.toThrow(
      "Please use your Potomack Workspace account",
    );
    expect(currentUser.getIdTokenResult).toHaveBeenCalledWith(true);
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it("signs out and rejects refreshed users whose email is unverified", async () => {
    const currentUser = firebaseUser({
      uid: "firebase-unverified",
      claims: {
        email: "staff@potomackco.com",
        email_verified: false,
        firebase: { sign_in_provider: "google.com" },
      },
    });
    const auth = { currentUser };
    const { signOut } = installFirebaseSdk({ auth });

    await expect(getFreshFirebaseIdToken()).rejects.toThrow(
      "Please use your Potomack Workspace account",
    );
    expect(currentUser.getIdTokenResult).toHaveBeenCalledWith(true);
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it("signs out and rejects refreshed users whose Firebase provider is not Google", async () => {
    const currentUser = firebaseUser({
      uid: "firebase-password",
      claims: {
        email: "staff@potomackco.com",
        email_verified: true,
        firebase: { sign_in_provider: "password" },
      },
    });
    const auth = { currentUser };
    const { signOut } = installFirebaseSdk({ auth });

    await expect(getFreshFirebaseIdToken()).rejects.toThrow(
      "Please use your Potomack Workspace account",
    );
    expect(currentUser.getIdTokenResult).toHaveBeenCalledWith(true);
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it("signs out and rejects sign-in when Firebase claims fail the practical layer", async () => {
    const popupUser = firebaseUser({
      uid: "firebase-unverified",
      claims: {
        email: "staff@potomackco.com",
        email_verified: false,
        firebase: { sign_in_provider: "google.com" },
      },
    });
    const { signOut } = installFirebaseSdk({ popupUser });

    await expect(signInWithGoogle()).rejects.toThrow(
      "Please use your Potomack Workspace account",
    );
    expect(signOut).toHaveBeenCalled();
  });
});
