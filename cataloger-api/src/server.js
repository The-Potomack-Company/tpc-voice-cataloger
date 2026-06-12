import { createServer } from "node:http";
import {
  ALLOWED_DOMAIN,
  deactivatedCustomClaims,
  isAllowedWorkspaceEmail,
  validateWorkspaceSignIn,
  workspaceCustomClaims,
} from "./claimPolicy.js";
import { createPgProfileStore } from "./profileStore.js";

const PORT = Number(process.env.PORT ?? 8080);
const RETENTION_DAYS = 30;
const PROD_ALLOWED_ORIGINS = [
  "https://app.potomackco.com",
  "https://gen-lang-client-0662587427.web.app",
];
const FIREBASE_ADMIN_APP_MODULE = "firebase-admin/app";
const FIREBASE_ADMIN_AUTH_MODULE = "firebase-admin/auth";
const FIREBASE_ADMIN_STORAGE_MODULE = "firebase-admin/storage";
const DEFAULT_ORPHAN_GRACE_HOURS = 24;
const ORPHAN_DELETE_BATCH_SIZE = 100;
const ORPHAN_DELETE_CONCURRENCY = 8;
const DEFAULT_ALLOWED_ORIGINS = [
  ...PROD_ALLOWED_ORIGINS,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function parseAllowedOrigins(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : PROD_ALLOWED_ORIGINS;
}

export function allowedOriginsFromEnv(env = process.env) {
  return parseAllowedOrigins(env.CATALOGER_API_ALLOWED_ORIGINS);
}

function corsHeaders(req, allowedOrigins = allowedOriginsFromEnv()) {
  const origin = req.headers.origin;
  const headers = {
    vary: "Origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "600",
  };

  if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
  }

  return headers;
}

function routePath(req) {
  return new URL(req.url ?? "/", "http://cataloger-api.local").pathname;
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function audioOrphanGraceMs(env) {
  const configuredHours = Number(env.PURGE_AUDIO_ORPHAN_GRACE_HOURS);
  const graceHours = Number.isFinite(configuredHours)
    ? Math.max(configuredHours, DEFAULT_ORPHAN_GRACE_HOURS)
    : DEFAULT_ORPHAN_GRACE_HOURS;
  return graceHours * 60 * 60 * 1000;
}

function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function hasWorkspaceClaims(decoded) {
  return decoded?.workspace === ALLOWED_DOMAIN
    && decoded?.workspace_role === "authenticated";
}

async function verifyWorkspaceToken(req, auth) {
  const token = bearerToken(req);
  if (!token) {
    throw Object.assign(new Error("Bearer Firebase ID token required"), { status: 401 });
  }
  const decoded = await auth.verifyIdToken(token, true);
  if (!hasWorkspaceClaims(decoded)) {
    throw Object.assign(new Error("Firebase workspace claim required"), { status: 403 });
  }
  return decoded;
}

async function requireAdmin(req, auth, profiles) {
  const decoded = await verifyWorkspaceToken(req, auth);
  const profile = await profiles.getProfile(decoded.uid);
  if (profile?.role !== "admin" || profile?.is_active !== true) {
    throw Object.assign(new Error("Admin privileges required"), { status: 403 });
  }
  return { decoded, profile };
}

async function handleClaim(req, res, auth, cors = {}) {
  const token = bearerToken(req);
  if (!token) {
    json(res, 401, { error: "Bearer Firebase ID token required" }, cors);
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token, true);
    if (decoded.workspace === "potomackco.com" && decoded.workspace_role === "authenticated") {
      json(res, 200, { ok: true, refreshRequired: false }, cors);
      return;
    }

    const user = await auth.getUser(decoded.uid);
    const verdict = validateWorkspaceSignIn(decoded, user);
    if (!verdict.ok) {
      json(res, 403, { error: verdict.reason }, cors);
      return;
    }

    await auth.setCustomUserClaims(decoded.uid, workspaceCustomClaims(user.customClaims));
    json(res, 200, { ok: true, refreshRequired: true }, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Firebase ID token";
    json(res, 401, { error: message }, cors);
  }
}

async function handleCreateUser(req, res, auth, profiles, cors = {}) {
  const { email, password, displayName } = await readJson(req);
  if (!email || !displayName) {
    json(res, 400, { error: "email and displayName are required" }, cors);
    return;
  }
  if (!isAllowedWorkspaceEmail(email)) {
    json(res, 400, { error: "Email must be in the Potomack Workspace domain" }, cors);
    return;
  }

  let user = null;
  try {
    user = await auth.createUser({
      email,
      displayName,
      emailVerified: true,
      ...(password ? { password } : {}),
    });
    await auth.setCustomUserClaims(user.uid, workspaceCustomClaims({
      role: "specialist",
      is_active: true,
    }));
    await profiles.upsertProfile({
      id: user.uid,
      email: user.email ?? email,
      display_name: displayName,
      role: "specialist",
      is_active: true,
    });
    json(res, 200, { user: { id: user.uid, email: user.email ?? email } }, cors);
  } catch (err) {
    if (user?.uid) {
      await auth.deleteUser(user.uid).catch(() => {});
    }
    const message = err instanceof Error ? err.message : "Failed to create user";
    json(res, 400, { error: message }, cors);
  }
}

async function handleUpdateUser(req, res, auth, profiles, admin, cors = {}) {
  const { userId, activate } = await readJson(req);
  if (!userId || typeof activate !== "boolean") {
    json(res, 400, { error: "userId and activate (boolean) are required" }, cors);
    return;
  }
  if (userId === admin.decoded.uid) {
    json(res, 400, { error: "Cannot modify your own account" }, cors);
    return;
  }

  try {
    const user = await auth.getUser(userId);
    const baseClaims = activate
      ? workspaceCustomClaims({ ...(user.customClaims ?? {}), is_active: true })
      : deactivatedCustomClaims(user.customClaims ?? {});
    await auth.updateUser(userId, { disabled: !activate });
    await auth.setCustomUserClaims(userId, baseClaims);
    await profiles.updateActive(userId, activate);
    json(res, 200, { success: true }, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    json(res, 400, { error: message }, cors);
  }
}

async function listAllAuthUsers(auth) {
  const byId = new Map();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) byId.set(user.uid, user);
    pageToken = page.pageToken;
  } while (pageToken);
  return byId;
}

async function handleListUsers(res, auth, profiles, cors = {}) {
  const [profileRows, authUsers] = await Promise.all([
    profiles.listProfiles(),
    listAllAuthUsers(auth),
  ]);
  const accounts = profileRows.map((profile) => {
    const user = authUsers.get(profile.id);
    return {
      id: profile.id,
      email: user?.email ?? profile.email ?? "",
      display_name: profile.display_name,
      role: profile.role,
      is_active: profile.is_active && user?.disabled !== true,
      created_at: profile.created_at instanceof Date
        ? profile.created_at.toISOString()
        : profile.created_at,
    };
  });
  json(res, 200, { accounts }, cors);
}

async function firebaseFileCreatedAtMs(file) {
  const listedMetadata = file.metadata ?? {};
  const metadata = listedMetadata.timeCreated
    ? listedMetadata
    : (await file.getMetadata?.())?.[0] ?? listedMetadata;
  const createdAt = metadata.timeCreated ?? metadata.time_created;
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs) ? createdAtMs : null;
}

async function listFirebaseObjects(storage, prefix) {
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({ prefix });
  return Promise.all(files.map(async (file) => ({
    name: file.name,
    createdAtMs: await firebaseFileCreatedAtMs(file),
  })));
}

async function deleteFirebaseObjects(storage, paths) {
  const bucket = storage.bucket();
  await Promise.all(paths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })));
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function batchesOf(values, size) {
  const batches = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

async function mapWithConcurrency(values, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(values[currentIndex]);
      }
    },
  );
  await Promise.all(workers);
}

async function deleteRecheckedOrphanObjects(storage, profiles, paths) {
  const candidatePaths = uniqueValues(paths);
  if (candidatePaths.length === 0) {
    return {
      paths: [],
      scanned: 0,
      deleted: 0,
      skipped: 0,
      batches: 0,
    };
  }

  const existingPaths = new Set(await profiles.listExistingAudioPaths(candidatePaths));
  const deletePaths = candidatePaths.filter((path) => !existingPaths.has(path));
  const skipped = candidatePaths.length - deletePaths.length;
  const removedPaths = [];
  const bucket = storage.bucket();

  const batches = batchesOf(deletePaths, ORPHAN_DELETE_BATCH_SIZE);
  for (const [batchIndex, batch] of batches.entries()) {
    await mapWithConcurrency(batch, ORPHAN_DELETE_CONCURRENCY, async (path) => {
      await bucket.file(path).delete({ ignoreNotFound: true });
      removedPaths.push(path);
    });
    console.info("[purge-audio] orphan delete progress", {
      batch: batchIndex + 1,
      batches: batches.length,
      scanned: candidatePaths.length,
      deleted: removedPaths.length,
      skipped,
    });
  }

  return {
    paths: removedPaths,
    scanned: candidatePaths.length,
    deleted: removedPaths.length,
    skipped,
    batches: batches.length,
  };
}

async function handlePurgeAudio(req, res, profiles, storage, env = process.env, cors = {}) {
  if (!storage) {
    json(res, 500, { error: "Firebase Storage is not configured" }, cors);
    return;
  }
  const expectedSecret = env.PURGE_AUDIO_SECRET;
  if (!expectedSecret) {
    json(res, 500, { error: "PURGE_AUDIO_SECRET not configured" }, cors);
    return;
  }
  if (req.headers["x-purge-secret"] !== expectedSecret) {
    json(res, 401, { error: "unauthorized" }, cors);
    return;
  }

  const cutoffIso = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const orphanGraceMs = audioOrphanGraceMs(env);
  const orphanCreatedBeforeMs = Date.now() - orphanGraceMs;
  const [expiredRows, knownPaths, storageObjects] = await Promise.all([
    profiles.listExpiredAudio(cutoffIso),
    profiles.listKnownAudioPaths(),
    listFirebaseObjects(storage, "audio/"),
  ]);
  const known = new Set(knownPaths);
  const expiredPaths = expiredRows.map((row) => row.storage_path).filter(Boolean);
  const expiredIds = expiredRows.map((row) => row.id).filter(Boolean);
  const orphanCandidates = storageObjects
    .filter((object) => object.createdAtMs !== null && object.createdAtMs < orphanCreatedBeforeMs)
    .map((object) => object.name)
    .filter((path) => !known.has(path));

  const uniqueExpiredPaths = uniqueValues(expiredPaths);
  if (uniqueExpiredPaths.length > 0) {
    await deleteFirebaseObjects(storage, uniqueExpiredPaths);
  }
  const orphanProgress = await deleteRecheckedOrphanObjects(storage, profiles, orphanCandidates);
  await profiles.deleteAudioByIds(expiredIds);

  const progress = {
    expired: {
      scanned: expiredPaths.length,
      deleted: uniqueExpiredPaths.length,
      skipped: 0,
    },
    orphans: {
      scanned: orphanProgress.scanned,
      deleted: orphanProgress.deleted,
      skipped: orphanProgress.skipped,
    },
  };
  console.info("[purge-audio] completed", progress);

  json(res, 200, {
    removed: new Set([...uniqueExpiredPaths, ...orphanProgress.paths]).size,
    expired: expiredPaths.length,
    orphans: orphanProgress.deleted,
    progress,
  }, cors);
}

export function createRequestHandler({
  auth,
  storage,
  profiles,
  profileStoreFactory = createPgProfileStore,
  env = process.env,
  allowedOrigins = allowedOriginsFromEnv(),
}) {
  let profileStorePromise = profiles ? Promise.resolve(profiles) : null;
  const getProfiles = () => {
    profileStorePromise ??= profileStoreFactory(env);
    return profileStorePromise;
  };

  return (req, res) => {
    const path = routePath(req);
    if (req.method === "GET" && path === "/healthz") {
      json(res, 200, { ok: true });
      return;
    }

    if (
      path === "/session/claim"
      || path === "/admin/create-user"
      || path === "/admin/update-user"
      || path === "/admin/list-users"
      || path === "/purge-audio"
    ) {
      const cors = corsHeaders(req, allowedOrigins);
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        res.end();
        return;
      }
      if (path === "/session/claim" && req.method === "POST") {
        void handleClaim(req, res, auth, cors);
        return;
      }
      if (path.startsWith("/admin/") && (req.method === "POST" || req.method === "GET")) {
        void (async () => {
          try {
            const profileStore = await getProfiles();
            const admin = await requireAdmin(req, auth, profileStore);
            if (path === "/admin/create-user" && req.method === "POST") {
              await handleCreateUser(req, res, auth, profileStore, cors);
              return;
            }
            if (path === "/admin/update-user" && req.method === "POST") {
              await handleUpdateUser(req, res, auth, profileStore, admin, cors);
              return;
            }
            if (path === "/admin/list-users" && req.method === "GET") {
              await handleListUsers(res, auth, profileStore, cors);
              return;
            }
            json(res, 405, { error: "Method not allowed" }, cors);
          } catch (err) {
            const status = typeof err?.status === "number" ? err.status : 500;
            const message = err instanceof Error ? err.message : "Request failed";
            json(res, status, { error: message }, cors);
          }
        })();
        return;
      }
      if (path === "/purge-audio" && req.method === "POST") {
        void getProfiles()
          .then((profileStore) => handlePurgeAudio(req, res, profileStore, storage, env, cors))
          .catch((err) => {
            const message = err instanceof Error ? err.message : "Purge failed";
            json(res, 500, { error: message }, cors);
          });
        return;
      }
    }

    json(res, 404, { error: "Not found" });
  };
}

export async function startServer() {
  const [{ initializeApp, applicationDefault }, { getAuth }, { getStorage }] = await Promise.all([
    import(/* @vite-ignore */ FIREBASE_ADMIN_APP_MODULE),
    import(/* @vite-ignore */ FIREBASE_ADMIN_AUTH_MODULE),
    import(/* @vite-ignore */ FIREBASE_ADMIN_STORAGE_MODULE),
  ]);

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? "gen-lang-client-0662587427",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "gen-lang-client-0662587427.firebasestorage.app",
  });

  const auth = getAuth();
  const storage = getStorage(app);
  return createServer(createRequestHandler({ auth, storage })).listen(PORT, "0.0.0.0");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startServer();
}
