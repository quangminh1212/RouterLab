import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/keys/[id]/reveal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns full key for an existing api key id", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getApiKeyById: vi.fn().mockResolvedValue({ id: "k1", key: "sk-ABCDEFGHIJKLMNOPQRSTUVWX" }),
    }));

    const { GET } = await import("@/app/api/keys/[id]/reveal/route");
    const response = await GET(new Request("http://localhost/api/keys/k1/reveal"), {
      params: Promise.resolve({ id: "k1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ key: "sk-ABCDEFGHIJKLMNOPQRSTUVWX" });
  });

  it("returns 404 when key is missing", async () => {
    vi.doMock("@/lib/localDb", () => ({ getApiKeyById: vi.fn().mockResolvedValue(null) }));

    const { GET } = await import("@/app/api/keys/[id]/reveal/route");
    const response = await GET(new Request("http://localhost/api/keys/missing/reveal"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Key not found" });
  });
});
