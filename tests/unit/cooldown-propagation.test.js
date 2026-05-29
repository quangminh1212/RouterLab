import { describe, it, expect, vi, beforeEach } from "vitest";

const authMocks = vi.hoisted(() => ({
  getProviderCredentials: vi.fn(),
  markAccountUnavailable: vi.fn(),
  clearAccountError: vi.fn(),
  extractApiKey: vi.fn(),
  isValidApiKey: vi.fn(),
}));

const localDbMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  getModelInfo: vi.fn(),
}));

const tokenRefreshMocks = vi.hoisted(() => ({
  checkAndRefreshToken: vi.fn(),
  updateProviderCredentials: vi.fn(),
}));

const embeddingsCoreMocks = vi.hoisted(() => ({
  handleEmbeddingsCore: vi.fn(),
}));

const searchCoreMocks = vi.hoisted(() => ({
  handleWebSearchCore: vi.fn(),
}));

vi.mock("@/sse/services/auth", () => authMocks);
vi.mock("@/lib/localDb", () => localDbMocks);
vi.mock("@/sse/services/model", () => modelMocks);
vi.mock("@/sse/services/tokenRefresh", () => tokenRefreshMocks);
vi.mock("open-sse/handlers/embeddingsCore.js", () => embeddingsCoreMocks);
vi.mock("open-sse/handlers/webSearchCore.js", () => searchCoreMocks);
vi.mock("@/sse/utils/logger", () => ({
  request: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  maskKey: vi.fn(() => "masked"),
}));

describe("handler cooldown propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localDbMocks.getSettings.mockResolvedValue({ requireApiKey: false });
    authMocks.extractApiKey.mockReturnValue(null);
    authMocks.isValidApiKey.mockResolvedValue(true);
    authMocks.getProviderCredentials.mockResolvedValue({
      connectionId: "conn-1",
      connectionName: "Conn 1",
      accessToken: "token",
    });
    authMocks.clearAccountError.mockResolvedValue(undefined);
    authMocks.markAccountUnavailable.mockResolvedValue({ shouldFallback: false });
    modelMocks.getModelInfo.mockImplementation(async (modelStr) => {
      const [provider, model] = String(modelStr).split("/");
      return { provider, model };
    });
    tokenRefreshMocks.checkAndRefreshToken.mockImplementation(async (_provider, credentials) => credentials);
    tokenRefreshMocks.updateProviderCredentials.mockResolvedValue(undefined);
  });

  it("passes resetsAtMs from embeddings core into account cooldown", async () => {
    embeddingsCoreMocks.handleEmbeddingsCore.mockResolvedValue({
      success: false,
      status: 429,
      error: "Rate limit exceeded",
      resetsAtMs: 1780045000000,
      response: new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), { status: 429 }),
    });

    const { handleEmbeddings } = await import("../../src/sse/handlers/embeddings.js");
    const req = new Request("http://localhost/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: "hello" }),
    });

    await handleEmbeddings(req);

    expect(authMocks.markAccountUnavailable).toHaveBeenCalledWith(
      "conn-1",
      429,
      "Rate limit exceeded",
      "openai",
      "text-embedding-3-small",
      1780045000000,
      expect.any(Object),
    );
  });

  it("passes resetsAtMs from web search core into account cooldown", async () => {
    searchCoreMocks.handleWebSearchCore.mockResolvedValue({
      success: false,
      status: 429,
      error: "Too many requests",
      resetsAtMs: 1780046000000,
      response: new Response(JSON.stringify({ error: { message: "Too many requests" } }), { status: 429 }),
    });

    const { handleWebSearch } = await import("../../src/sse/handlers/webSearch.js");
    const req = new Request("http://localhost/v1/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "brave/search", query: "router" }),
    });

    await handleWebSearch(req);

    expect(authMocks.markAccountUnavailable).toHaveBeenCalledWith(
      "conn-1",
      429,
      "Too many requests",
      "brave",
      "search",
      1780046000000,
      expect.any(Object),
    );
  });
});
