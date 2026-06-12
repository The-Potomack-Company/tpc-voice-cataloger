import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Firebase Storage rules", () => {
  const rules = readFileSync("storage.rules", "utf8");

  it("requires the server-minted workspace claim", () => {
    expect(rules).toContain('request.auth.token.workspace == "potomackco.com"');
    expect(rules).toContain('request.auth.token.workspace_role == "authenticated"');
  });

  it("keeps photo and audio paths scoped by session access", () => {
    expect(rules).toContain("match /photos/{sessionId}/{itemId}/{fileName}");
    expect(rules).toContain("match /audio/{sessionId}/{itemId}/{fileName}");
    expect(rules).toContain("request.auth.token.session_access[sessionId] == true");
  });
});
