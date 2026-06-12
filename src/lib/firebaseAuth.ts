const FIREBASE_SDK_VERSION = "12.14.0";
const ALLOWED_DOMAIN = "potomackco.com";
const WORKSPACE_CLAIM = "workspace";
const WORKSPACE_ROLE_CLAIM = "workspace_role";

export interface FirebaseClaims {
  role?: string;
  roles?: string[];
  admin?: boolean;
  is_active?: boolean;
  hd?: string;
  workspace?: string;
  workspace_role?: string;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    sign_in_provider?: string;
    identities?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface AppUser {
  id: string;
  email?: string | null;
  displayName?: string | null;
  claims?: FirebaseClaims;
}

export interface AppSession {
  access_token: string;
  provider: "firebase";
  user: AppUser;
}

interface FirebaseSdk {
  initializeApp: (config: Record<string, string>) => unknown;
  getApps: () => unknown[];
  getApp: () => unknown;
  getAuth: (app?: unknown) => unknown;
  GoogleAuthProvider: new () => { setCustomParameters: (params: Record<string, string>) => void };
  getAdditionalUserInfo: (result: FirebaseSignInResult) => { profile?: { hd?: unknown } | null } | null;
  onAuthStateChanged: (
    auth: unknown,
    nextOrObserver: (user: FirebaseSdkUser | null) => void,
  ) => () => void;
  signInWithPopup: (
    auth: unknown,
    provider: unknown,
  ) => Promise<FirebaseSignInResult>;
  signOut: (auth: unknown) => Promise<void>;
  updatePassword: (user: FirebaseSdkUser, newPassword: string) => Promise<void>;
}

interface FirebaseSignInResult {
  user: FirebaseSdkUser;
}

interface FirebaseSdkUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ token: string; claims: FirebaseClaims }>;
}

interface FirebaseAuthInstance {
  currentUser?: FirebaseSdkUser | null;
}

let sdkPromise: Promise<FirebaseSdk> | null = null;
let authInstance: unknown | null = null;

async function loadFirebaseSdk(): Promise<FirebaseSdk> {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
    ]).then(([app, auth]) => ({ ...app, ...auth }) as FirebaseSdk);
  }
  return sdkPromise;
}

export function resetFirebaseAuthForTests() {
  sdkPromise = null;
  authInstance = null;
}

export function setFirebaseSdkLoaderForTests(loader: () => Promise<FirebaseSdk>) {
  sdkPromise = loader();
  authInstance = null;
}

function getFirebaseConfig() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Firebase auth is missing config: ${missing.join(", ")}`);
  }

  return config as Record<string, string>;
}

async function getFirebaseAuth() {
  if (authInstance) return authInstance;
  const sdk = await loadFirebaseSdk();
  const app = sdk.getApps().length > 0 ? sdk.getApp() : sdk.initializeApp(getFirebaseConfig());
  authInstance = sdk.getAuth(app);
  return authInstance;
}

function isAllowedEmail(email?: string | null): boolean {
  return String(email ?? "").toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

function hasGoogleProviderClaim(claims: FirebaseClaims): boolean {
  const firebase = claims.firebase;
  const identities = firebase?.identities;
  return (
    firebase?.sign_in_provider === "google.com" ||
    (identities ? Object.prototype.hasOwnProperty.call(identities, "google.com") : false)
  );
}

function hasVerifiedWorkspaceClaims(claims: FirebaseClaims): boolean {
  return (
    claims.email_verified === true &&
    hasGoogleProviderClaim(claims) &&
    claims[WORKSPACE_CLAIM] === ALLOWED_DOMAIN &&
    claims[WORKSPACE_ROLE_CLAIM] === "authenticated"
  );
}

function assertAllowedDomain(user: FirebaseSdkUser, claims: FirebaseClaims) {
  const claimEmail = typeof claims.email === "string" ? claims.email : null;
  const email = user.email ?? claimEmail;

  if (!isAllowedEmail(email) || !hasVerifiedWorkspaceClaims(claims)) {
    throw new Error("Please use your Potomack Workspace account");
  }
}

export async function getFreshFirebaseIdToken(): Promise<string> {
  const auth = (await getFirebaseAuth()) as FirebaseAuthInstance;
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No active Firebase session — user must sign in");
  }
  const tokenResult = await user.getIdTokenResult(true);
  try {
    assertAllowedDomain(user, tokenResult.claims);
  } catch (err) {
    const sdk = await loadFirebaseSdk();
    await sdk.signOut(auth);
    throw err;
  }
  return tokenResult.token;
}

async function claimWorkspaceSession(token: string): Promise<void> {
  const apiUrl = import.meta.env.VITE_CATALOGER_API_URL;
  if (!apiUrl) {
    throw new Error("VITE_CATALOGER_API_URL is not set. Add it to .env.local");
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/session/claim`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    let message = "Please use your Potomack Workspace account";
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the stable sign-in error if the API did not return JSON.
    }
    throw new Error(message);
  }
}

function assertPopupHostedDomain(result: FirebaseSignInResult, sdk: FirebaseSdk) {
  const hd = sdk.getAdditionalUserInfo(result)?.profile?.hd;
  if (hd !== ALLOWED_DOMAIN) {
    throw new Error("Please use your Potomack Workspace account");
  }
}

async function toAppSession(user: FirebaseSdkUser): Promise<AppSession> {
  let tokenResult = await user.getIdTokenResult();
  if (
    tokenResult.claims[WORKSPACE_CLAIM] !== ALLOWED_DOMAIN ||
    tokenResult.claims[WORKSPACE_ROLE_CLAIM] !== "authenticated"
  ) {
    await claimWorkspaceSession(tokenResult.token || (await user.getIdToken()));
    tokenResult = await user.getIdTokenResult(true);
  }
  assertAllowedDomain(user, tokenResult.claims);
  return {
    access_token: tokenResult.token || (await user.getIdToken()),
    provider: "firebase",
    user: {
      id: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      claims: tokenResult.claims,
    },
  };
}

export function roleFromFirebaseClaims(user: AppUser | null | undefined): string | null {
  const claims = user?.claims;
  if (!user || claims?.is_active === false) return null;
  if (claims?.admin === true) return "admin";
  if (
    claims?.role === "dev" ||
    claims?.role === "admin" ||
    claims?.role === "manager" ||
    claims?.role === "specialist"
  ) return claims.role;
  if (Array.isArray(claims?.roles) && claims.roles.includes("admin")) return "admin";
  if (Array.isArray(claims?.roles) && claims.roles.includes("manager")) return "manager";
  return isAllowedEmail(user.email) && hasVerifiedWorkspaceClaims(claims ?? {})
    ? "specialist"
    : null;
}

export async function signInWithGoogle(): Promise<AppSession> {
  const sdk = await loadFirebaseSdk();
  const auth = await getFirebaseAuth();
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: "select_account" });
  const result = await sdk.signInWithPopup(auth, provider);
  try {
    assertPopupHostedDomain(result, sdk);
    return await toAppSession(result.user);
  } catch (err) {
    await sdk.signOut(auth);
    throw err;
  }
}

export async function signOutFirebase(): Promise<void> {
  const sdk = await loadFirebaseSdk();
  await sdk.signOut(await getFirebaseAuth());
}

export async function updateFirebasePassword(): Promise<{ error: Error | null }> {
  return {
    error: new Error("Password changes are managed by Google Workspace"),
  };
}

export function subscribeToFirebaseAuth(
  callback: (session: AppSession | null) => void,
): () => void {
  let active = true;
  let unsubscribe: (() => void) | null = null;
  void Promise.all([loadFirebaseSdk(), getFirebaseAuth()]).then(([sdk, auth]) => {
    if (!active) return;
    unsubscribe = sdk.onAuthStateChanged(auth, (user) => {
      if (!user) {
        callback(null);
        return;
      }
      void toAppSession(user)
        .then((session) => {
          if (active) callback(session);
        })
        .catch(() => {
          if (active) callback(null);
        });
    });
  }).catch(() => {
    if (active) callback(null);
  });

  return () => {
    active = false;
    unsubscribe?.();
  };
}
