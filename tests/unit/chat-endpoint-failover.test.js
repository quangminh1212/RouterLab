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
  getComboModels: vi.fn(),
}));

const tokenRefreshMocks = vi.hoisted(() => ({
  checkAndRefreshToken: vi.fn(),
  updateProviderCredentials: vi.fn(),
}));

const chatCoreMocks = vi.hoisted(() => ({
  handleChatCore: vi.fn(),
}));

const breakerMocks = vi.hoisted(() => ({
  canExecuteProvider: vi.fn(),
  isBreakerTrippableStatus: vi.fn(),
  recordProviderFailure: vi.fn(),
  recordProviderSuccess: vi.fn(),
}));

vi.mock("@/sse/services/auth", () => authMocks);
vi.mock("@/lib/localDb", () => localDbMocks);
vi.mock("@/sse/services/model", () => modelMocks);
vi.mock("@/sse/services/tokenRefresh", () => tokenRefreshMocks);
vi.mock("open-sse/handlers/chatCore.js", () => chatCoreMocks);
vi.mock("@/sse/services/providerBreaker", () => breakerMocks);
vi.mock("@/sse/utils/logger", () => ({
  request: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  maskKey: vi.fn(() => "masked"),
}));

describe("chat endpoint failover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localDbMocks.getSettings.mockResolvedValue({ requireApiKey: false, contextRelayEnabled: false });
    authMocks.extractApiKey.mockReturnValue(null);
    authMocks.isValidApiKey.mockResolvedValue(true);
    authMocks.clearAccountError.mockResolvedValue(undefined);
    authMocks.markAccountUnavailable.mockResolvedValue({ shouldFallback: true, cooldownMs: 30000 });
    modelMocks.getComboModels.mockResolvedValue(null);
    modelMocks.getModelInfo.mockResolvedValue({ provider: "openai-compatible-tammao", model: "tammao/gpt-5.5" });
    tokenRefreshMocks.checkAndRefreshToken.mockImplementation(async (_provider, credentials) => credentials);
    tokenRefreshMocks.updateProviderCredentials.mockResolvedValue(undefined);
    breakerMocks.canExecuteProvider.mockReturnValue(true);
    breakerMocks.isBreakerTrippableStatus.mockImplementation((status) => status === 503);
    breakerMocks.recordProviderFailure.mockImplementation(() => {});
    breakerMocks.recordProviderSuccess.mockImplementation(() => {});

    authMocks.getProviderCredentials
      .mockResolvedValueOnce({
        connectionId: "conn-1",
        connectionName: "TamMao #1",
        apiKey: "key-1",
        providerSpecificData: { baseUrl: "https://api.dientuai.io.vn/v1" },
      })
      .mockResolvedValueOnce({
        connectionId: "conn-2",
        connectionName: "TamMao #2",
        apiKey: "key-2",
        providerSpecificData: { baseUrl: "https://api.electroai.io.vn/v1" },
      });

    chatCoreMocks.handleChatCore
      .mockResolvedValueOnce({
        success: false,
        status: 503,
        error: "upstream unavailable",
        response: new Response(JSON.stringify({ error: { message: "upstream unavailable" } }), { status: 503 }),
      })
      .mockResolvedValueOnce({
        success: true,
        response: Response.json({ id: "resp_ok", object: "response" }),
      });
  });

  it("switches to the next TamMao endpoint immediately after a transient upstream failure", async () => {
    const { handleChat } = await import("../../src/sse/handlers/chat.js");
    const request = new Request("http://localhost/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai-compatible-tammao/tammao/gpt-5.5", input: "ping" }),
    });

    const response = await handleChat(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe("resp_ok");
    expect(breakerMocks.recordProviderFailure).toHaveBeenCalledWith("openai-compatible-tammao", 503);
    expect(authMocks.markAccountUnavailable).toHaveBeenCalledWith(
      "conn-1",
      503,
      "upstream unavailable",
      "openai-compatible-tammao",
      "tammao/gpt-5.5",
      undefined,
      expect.any(Object),
    );
    expect(authMocks.getProviderCredentials).toHaveBeenCalledTimes(2);
    expect(chatCoreMocks.handleChatCore).toHaveBeenCalledTimes(2);
  });
});
