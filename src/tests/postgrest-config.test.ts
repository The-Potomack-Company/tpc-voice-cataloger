import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("PostgREST Firebase JWT config", () => {
  const config = readFileSync("postgrest/postgrest.conf", "utf8");

  it("keeps JWKS and Firebase audience env-injected", () => {
    expect(config).not.toContain("jwt-secret");
    expect(config).not.toContain("jwt-aud");
  });

  it("maps only workspace-claimed tokens to authenticated", () => {
    expect(config).toContain('jwt-role-claim-key = ".workspace_role"');
    expect(config).toContain('db-pre-request = "public.require_workspace_claim"');
  });
});
