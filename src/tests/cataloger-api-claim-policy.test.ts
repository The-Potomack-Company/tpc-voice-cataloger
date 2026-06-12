import { describe, expect, it } from "vitest";

const policy = await import("../../cataloger-api/src/claimPolicy.js");

describe("cataloger-api workspace claim policy", () => {
  const decoded = {
    uid: "firebase-uid",
    email: "staff@potomackco.com",
    email_verified: true,
    firebase: {
      sign_in_provider: "google.com",
      identities: { "google.com": ["staff@potomackco.com"] },
    },
  };
  const user = {
    email: "staff@potomackco.com",
    emailVerified: true,
    providerData: [{ providerId: "google.com" }],
  };

  it("accepts verified Google Workspace identities", () => {
    expect(policy.validateWorkspaceSignIn(decoded, user)).toEqual({ ok: true });
  });

  it("rejects non-workspace email domains", () => {
    expect(
      policy.validateWorkspaceSignIn({ ...decoded, email: "staff@example.com" }, user),
    ).toEqual({ ok: false, reason: "Email must be in the Potomack Workspace domain" });
  });

  it("rejects tokens without Google provider invariants", () => {
    expect(
      policy.validateWorkspaceSignIn(
        { ...decoded, firebase: { sign_in_provider: "password" } },
        user,
      ),
    ).toEqual({ ok: false, reason: "Google Workspace sign-in is required" });
  });

  it("mints only the workspace and PostgREST role claims over existing claims", () => {
    expect(policy.workspaceCustomClaims({ role: "admin" })).toEqual({
      role: "admin",
      workspace: "potomackco.com",
      workspace_role: "authenticated",
    });
  });
});
