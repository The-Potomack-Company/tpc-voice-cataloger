import { describe, expect, it, vi } from "vitest";

const { createRequestHandler } = await import("../../cataloger-api/src/server.js");

type HeaderValue = string | number | readonly string[];
type HeaderMap = Record<string, HeaderValue | undefined>;

function requestClaimPreflight(origin: string) {
  const handler = createRequestHandler({
    auth: {},
    allowedOrigins: ["https://app.potomackco.com"],
  });
  const response = {
    body: "",
    headers: {} as HeaderMap,
    status: 0,
    writeHead(status: number, headers: HeaderMap) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
  };

  handler({
    method: "OPTIONS",
    url: "/session/claim",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  }, response);

  return {
    status: response.status,
    header(name: string) {
      const value = response.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(", ") : value;
    },
  };
}

describe("cataloger-api /session/claim CORS", () => {
  it("answers allowed browser preflight requests with CORS headers", () => {
    const response = requestClaimPreflight("https://app.potomackco.com");

    expect(response.status).toBe(204);
    expect(response.header("access-control-allow-origin")).toBe(
      "https://app.potomackco.com",
    );
    expect(response.header("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(response.header("access-control-allow-headers")).toBe(
      "Authorization, Content-Type",
    );
  });

  it("does not reflect disallowed preflight origins", () => {
    const response = requestClaimPreflight("https://evil.example.com");

    expect(response.status).toBe(204);
    expect(response.header("access-control-allow-origin")).toBeUndefined();
  });
});

function callHandler(handler: ReturnType<typeof createRequestHandler>, options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  return new Promise<{ status: number; headers: HeaderMap; body: string }>((resolve) => {
    const body = options.body === undefined ? "" : JSON.stringify(options.body);
    const response = {
      body: "",
      headers: {} as HeaderMap,
      status: 0,
      writeHead(status: number, headers: HeaderMap) {
        this.status = status;
        this.headers = headers;
      },
      end(responseBody = "") {
        this.body = responseBody;
        resolve({ status: this.status, headers: this.headers, body: this.body });
      },
    };
    const request = {
      method: options.method,
      url: options.url,
      headers: {
        authorization: "Bearer token",
        origin: "https://app.potomackco.com",
        ...(options.headers ?? {}),
      },
      async *[Symbol.asyncIterator]() {
        if (body) yield body;
      },
    };
    handler(request, response);
  });
}

describe("cataloger-api admin routes", () => {
  it("creates a Firebase user, mints workspace claims, and upserts a profile", async () => {
    const auth = {
      verifyIdToken: async () => ({
        uid: "admin-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      }),
      createUser: vi.fn().mockResolvedValue({
        uid: "user-1",
        email: "specialist@potomackco.com",
      }),
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
      deleteUser: vi.fn(),
    };
    const profiles = {
      getProfile: vi.fn().mockResolvedValue({
        id: "admin-1",
        role: "admin",
        is_active: true,
      }),
      upsertProfile: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createRequestHandler({
      auth,
      profiles,
      allowedOrigins: ["https://app.potomackco.com"],
    });

    const response = await callHandler(handler, {
      method: "POST",
      url: "/admin/create-user",
      body: {
        email: "specialist@potomackco.com",
        password: "temporary",
        displayName: "Jane Specialist",
      },
    });

    expect(response.status).toBe(200);
    expect(auth.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "specialist@potomackco.com",
      displayName: "Jane Specialist",
    }));
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("user-1", expect.objectContaining({
      role: "specialist",
      is_active: true,
      workspace: "potomackco.com",
      workspace_role: "authenticated",
    }));
    expect(profiles.upsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      id: "user-1",
      role: "specialist",
      is_active: true,
    }));
  });

  it("purges expired and orphaned Firebase audio objects", async () => {
    const deleteExpired = vi.fn().mockResolvedValue(undefined);
    const deleteOrphan = vi.fn().mockResolvedValue(undefined);
    const oldTimeCreated = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const storage = {
      bucket: () => ({
        getFiles: vi.fn().mockResolvedValue([[
          { name: "audio/session/item/expired.webm", metadata: { timeCreated: oldTimeCreated } },
          { name: "audio/session/item/orphan.webm", metadata: { timeCreated: oldTimeCreated } },
        ]]),
        file: (path: string) => ({
          delete: path.includes("orphan") ? deleteOrphan : deleteExpired,
        }),
      }),
    };
    const profiles = {
      listExpiredAudio: vi.fn().mockResolvedValue([
        {
          id: "00000000-0000-0000-0000-000000000001",
          storage_path: "audio/session/item/expired.webm",
        },
      ]),
      listKnownAudioPaths: vi.fn().mockResolvedValue(["audio/session/item/expired.webm"]),
      hasAudioPath: vi.fn().mockResolvedValue(false),
      deleteAudioByIds: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createRequestHandler({
      auth: {},
      storage,
      profiles,
      env: { PURGE_AUDIO_SECRET: "secret" },
      allowedOrigins: ["https://app.potomackco.com"],
    });

    const response = await callHandler(handler, {
      method: "POST",
      url: "/purge-audio",
      headers: { "x-purge-secret": "secret" },
      body: {},
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ removed: 2, expired: 1, orphans: 1 });
    expect(deleteExpired).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(deleteOrphan).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(profiles.hasAudioPath).toHaveBeenCalledWith("audio/session/item/orphan.webm");
    expect(profiles.deleteAudioByIds).toHaveBeenCalledWith([
      "00000000-0000-0000-0000-000000000001",
    ]);
  });

  it("skips young Firebase audio orphans inside the grace period", async () => {
    const deleteYoungOrphan = vi.fn().mockResolvedValue(undefined);
    const youngTimeCreated = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const storage = {
      bucket: () => ({
        getFiles: vi.fn().mockResolvedValue([[
          { name: "audio/session/item/young.webm", metadata: { timeCreated: youngTimeCreated } },
        ]]),
        file: () => ({ delete: deleteYoungOrphan }),
      }),
    };
    const profiles = {
      listExpiredAudio: vi.fn().mockResolvedValue([]),
      listKnownAudioPaths: vi.fn().mockResolvedValue([]),
      hasAudioPath: vi.fn().mockResolvedValue(false),
      deleteAudioByIds: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createRequestHandler({
      auth: {},
      storage,
      profiles,
      env: { PURGE_AUDIO_SECRET: "secret" },
      allowedOrigins: ["https://app.potomackco.com"],
    });

    const response = await callHandler(handler, {
      method: "POST",
      url: "/purge-audio",
      headers: { "x-purge-secret": "secret" },
      body: {},
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ removed: 0, expired: 0, orphans: 0 });
    expect(deleteYoungOrphan).not.toHaveBeenCalled();
    expect(profiles.hasAudioPath).not.toHaveBeenCalled();
  });

  it("deletes old Firebase audio orphans after the grace period", async () => {
    const deleteOldOrphan = vi.fn().mockResolvedValue(undefined);
    const oldTimeCreated = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const storage = {
      bucket: () => ({
        getFiles: vi.fn().mockResolvedValue([[
          { name: "audio/session/item/old.webm", metadata: { timeCreated: oldTimeCreated } },
        ]]),
        file: () => ({ delete: deleteOldOrphan }),
      }),
    };
    const profiles = {
      listExpiredAudio: vi.fn().mockResolvedValue([]),
      listKnownAudioPaths: vi.fn().mockResolvedValue([]),
      hasAudioPath: vi.fn().mockResolvedValue(false),
      deleteAudioByIds: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createRequestHandler({
      auth: {},
      storage,
      profiles,
      env: { PURGE_AUDIO_SECRET: "secret" },
      allowedOrigins: ["https://app.potomackco.com"],
    });

    const response = await callHandler(handler, {
      method: "POST",
      url: "/purge-audio",
      headers: { "x-purge-secret": "secret" },
      body: {},
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ removed: 1, expired: 0, orphans: 1 });
    expect(profiles.hasAudioPath).toHaveBeenCalledWith("audio/session/item/old.webm");
    expect(deleteOldOrphan).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("spares an orphan candidate when its audio metadata appears before delete", async () => {
    const deleteLateMetadataObject = vi.fn().mockResolvedValue(undefined);
    const oldTimeCreated = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const storage = {
      bucket: () => ({
        getFiles: vi.fn().mockResolvedValue([[
          { name: "audio/session/item/race.webm", metadata: { timeCreated: oldTimeCreated } },
        ]]),
        file: () => ({ delete: deleteLateMetadataObject }),
      }),
    };
    const profiles = {
      listExpiredAudio: vi.fn().mockResolvedValue([]),
      listKnownAudioPaths: vi.fn().mockResolvedValue([]),
      hasAudioPath: vi.fn().mockResolvedValue(true),
      deleteAudioByIds: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createRequestHandler({
      auth: {},
      storage,
      profiles,
      env: { PURGE_AUDIO_SECRET: "secret" },
      allowedOrigins: ["https://app.potomackco.com"],
    });

    const response = await callHandler(handler, {
      method: "POST",
      url: "/purge-audio",
      headers: { "x-purge-secret": "secret" },
      body: {},
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ removed: 0, expired: 0, orphans: 0 });
    expect(profiles.hasAudioPath).toHaveBeenCalledWith("audio/session/item/race.webm");
    expect(deleteLateMetadataObject).not.toHaveBeenCalled();
  });
});
