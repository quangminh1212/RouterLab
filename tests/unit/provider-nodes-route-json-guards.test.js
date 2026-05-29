import { beforeEach, describe, expect, it, vi } from "vitest";

describe("provider nodes route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/provider-nodes rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ createProviderNode: vi.fn(), getProviderNodes: vi.fn() }));
    vi.doMock("@/shared/constants/providers", () => ({ OPENAI_COMPATIBLE_PREFIX: "oc-", ANTHROPIC_COMPATIBLE_PREFIX: "ac-", CUSTOM_EMBEDDING_PREFIX: "ce-" }));
    vi.doMock("@/shared/utils", () => ({ generateId: vi.fn(() => "1") }));
    const { POST } = await import("@/app/api/provider-nodes/route");
    const response = await POST(new Request("http://localhost/api/provider-nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PUT /api/provider-nodes/[id] rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ deleteProviderConnectionsByProvider: vi.fn(), deleteProviderNode: vi.fn(), getProviderConnections: vi.fn(), getProviderNodeById: vi.fn(async () => ({ id: "1", type: "openai-compatible" })), updateProviderConnection: vi.fn(), updateProviderNode: vi.fn() }));
    const { PUT } = await import("@/app/api/provider-nodes/[id]/route");
    const response = await PUT(new Request("http://localhost/api/provider-nodes/1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
