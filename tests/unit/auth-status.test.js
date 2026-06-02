import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

const secret = new TextEncoder().encode("auth-status-test-secret");

vi.mock("@/lib/auth/sessionSecret", () => ({
  getAuthSecret: () => secret,
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(async () => ({ requireLogin: true })),
}));

vi.mock("@/lib/auth/credentials", () => ({
  hasStoredCredentials: vi.fn(async () => true),
}));

function buildRequest(token) {
  return new Request("http://localhost/api/auth/status", {
    headers: token ? { cookie: `auth_token=${token}` } : {},
  });
}

describe("GET /api/auth/status", () => {
  it("returns guest status without auth cookie", async () => {
    const { GET } = await import("@/app/api/auth/status/route");

    const response = await GET(buildRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      requireLogin: true,
      authMode: "oauth-qr",
      authenticated: false,
      displayName: "Guest",
      loginMethod: "None",
      oidcConfigured: false,
    });
  });

  it("returns authenticated password user status", async () => {
    const token = await new SignJWT({ authenticated: true, provider: "password", sub: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret);
    const { GET } = await import("@/app/api/auth/status/route");

    const response = await GET(buildRequest(token));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      authenticated: true,
      displayName: "admin",
      loginMethod: "Password",
      hasPassword: true,
      oidcLogin: false,
    });
  });
});
