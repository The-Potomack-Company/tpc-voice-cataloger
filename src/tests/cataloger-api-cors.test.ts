import { describe, expect, it } from "vitest";

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
    expect(response.header("access-control-allow-methods")).toBe("POST, OPTIONS");
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
