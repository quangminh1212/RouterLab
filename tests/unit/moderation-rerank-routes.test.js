import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/server
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
  },
}));

// Mock @/lib/localDb
vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(async () => ({
    requireApiKey: false,
  })),
}));

// Mock auth service
const mockCredentials = {
  connectionId: "test-conn-1",
  connectionName: "test-openai",
  apiKey: "sk-test-key",
};

vi.mock("@/sse/services/auth", () => ({
  getProviderCredentials: vi.fn(async () => mockCredentials),
  markAccountUnavailable: vi.fn(async () => ({ shouldFallback: false })),
  clearAccountError: vi.fn(async () => {}),
  extractApiKey: vi.fn(() => null),
  isValidApiKey: vi.fn(async () => true),
}));

// Mock model service
vi.mock("@/sse/services/model", () => ({
  getModelInfo: vi.fn(async (modelStr) => {
    const [provider, model] = modelStr.split("/");
    return { provider, model };
  }),
}));

// Mock token refresh
vi.mock("@/sse/services/tokenRefresh", () => ({
  checkAndRefreshToken: vi.fn(async (_provider, credentials) => credentials),
  updateProviderCredentials: vi.fn(async () => {}),
}));

// Mock logger
vi.mock("@/sse/utils/logger", () => ({
  request: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  maskKey: vi.fn((key) => key ? `${key.slice(0, 7)}...` : ""),
}));

describe("Moderation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("POST /v1/moderations returns OpenAI-compatible response", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "modr-test",
        model: "text-moderation-latest",
        results: [{ flagged: false, categories: {}, category_scores: {} }],
      }),
    }));

    const { POST } = await import("../../src/app/api/v1/moderations/route.js");
    const request = new Request("http://localhost/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "Hello world", model: "openai/text-moderation-latest" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.id).toBeTruthy();
    expect(body.model).toBe("text-moderation-latest");
    expect(body.results).toBeInstanceOf(Array);
  });

  it("POST /v1/moderations validates input field", async () => {
    const { POST } = await import("../../src/app/api/v1/moderations/route.js");
    const request = new Request("http://localhost/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-moderation-latest" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe("Rerank route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("POST /v1/rerank returns Cohere-compatible response", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "rerank-test",
        model: "rerank-v3.5",
        results: [
          { index: 0, relevance_score: 0.95 },
          { index: 1, relevance_score: 0.85 },
        ],
      }),
    }));

    const { POST } = await import("../../src/app/api/v1/rerank/route.js");
    const request = new Request("http://localhost/v1/rerank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "What is the capital of France?",
        documents: ["Paris is the capital.", "London is in England."],
        model: "cohere/rerank-v3.5",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.id).toBeTruthy();
    expect(body.model).toBe("rerank-v3.5");
    expect(body.results).toBeInstanceOf(Array);
  });

  it("POST /v1/rerank validates query and documents", async () => {
    const { POST } = await import("../../src/app/api/v1/rerank/route.js");
    const request = new Request("http://localhost/v1/rerank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "cohere/rerank-v3.5" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("POST /v1/rerank defaults to cohere/rerank-v3.5 when model omitted", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "rerank-test",
        model: "rerank-v3.5",
        results: [],
      }),
    }));

    const { POST } = await import("../../src/app/api/v1/rerank/route.js");
    const request = new Request("http://localhost/v1/rerank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "test",
        documents: ["doc1"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
