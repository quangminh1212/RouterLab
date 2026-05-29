import { beforeEach, describe, expect, it, vi } from "vitest";

describe("small v1 route input guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("/v1/embeddings normalizes model before forwarding", async () => {
    const handleEmbeddings = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.doMock("@/sse/handlers/embeddings.js", () => ({ handleEmbeddings }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/embeddings/route");
    await POST(new Request("http://localhost/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "  openai/text-embedding-3-small  ", input: "hi" }),
    }));

    await expect(handleEmbeddings.mock.calls[0][0].json()).resolves.toMatchObject({
      model: "openai/text-embedding-3-small",
      input: "hi",
    });
  });

  it("/v1/moderations returns standard error for invalid json", async () => {
    vi.doMock("@/sse/handlers/moderation.js", () => ({ handleModeration: vi.fn() }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/moderations/route");
    const response = await POST(new Request("http://localhost/v1/moderations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Invalid JSON body",
        type: "invalid_request_error",
      },
    });
  });

  it("/v1/rerank normalizes model and top_n before forwarding", async () => {
    const handleRerank = vi.fn().mockResolvedValue(Response.json({ results: [] }));
    vi.doMock("@/sse/handlers/rerank.js", () => ({ handleRerank }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/rerank/route");
    await POST(new Request("http://localhost/v1/rerank", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "  cohere/rerank-v3.5  ", query: "q", documents: ["a"], top_n: "3" }),
    }));

    await expect(handleRerank.mock.calls[0][0].json()).resolves.toMatchObject({
      model: "cohere/rerank-v3.5",
      query: "q",
      documents: ["a"],
      top_n: 3,
    });
  });
});
