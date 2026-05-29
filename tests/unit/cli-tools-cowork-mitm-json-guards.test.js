import { beforeEach, describe, expect, it, vi } from "vitest";

describe("cli tools cowork/mitm alias json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/cli-tools/cowork-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({
      default: {},
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      unlink: vi.fn(),
      rm: vi.fn(),
    }));
    vi.doMock("@/shared/constants/coworkPlugins", () => ({
      COWORK_PLUGINS: [],
      buildManagedMcpServers: vi.fn(() => []),
    }));

    const { POST } = await import("@/app/api/cli-tools/cowork-settings/route");
    const response = await POST(new Request("http://localhost/api/cli-tools/cowork-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PUT /api/cli-tools/antigravity-mitm/alias rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ getMitmAlias: vi.fn(), setMitmAliasAll: vi.fn() }));
    vi.doMock("@/mitm/manager", () => ({ getMitmStatus: vi.fn() }));

    const { PUT } = await import("@/app/api/cli-tools/antigravity-mitm/alias/route");
    const response = await PUT(new Request("http://localhost/api/cli-tools/antigravity-mitm/alias", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
