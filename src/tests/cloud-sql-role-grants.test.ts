import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloud SQL PostgREST role grants", () => {
  it("grants PostgREST request roles to the cataloger_app login role", () => {
    const migration = readFileSync(
      resolve("db/migrations/001_roles_and_jwt_helpers.sql"),
      "utf8",
    );

    expect(migration).toMatch(/grant\s+anon,\s*authenticated\s+to\s+cataloger_app;/i);
  });
});
