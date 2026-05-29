import { beforeEach, describe, expect, it, vi } from "vitest";

describe("model alias validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rejects self-mapping aliases on local alias route", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getModelAliases: vi.fn(),
      setModelAlias: vi.fn(),
      deleteModelAlias: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/models/alias", {
      method: "PUT",
      body: JSON.stringify({ model: "openclaw", alias: " openclaw " }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/must be different/i);
  });

  it("trims aliases before saving on local alias route", async () => {
    const setModelAlias = vi.fn().mockResolvedValue(true);
    vi.doMock("@/lib/localDb", () => ({
      getModelAliases: vi.fn(),
      setModelAlias,
      deleteModelAlias: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/models/alias", {
      method: "PUT",
      body: JSON.stringify({ model: " xlabrouter/openclaw ", alias: " smart " }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, model: "xlabrouter/openclaw", alias: "smart" });
    expect(setModelAlias).toHaveBeenCalledWith("smart", "xlabrouter/openclaw");
  });

  it("rejects self-mapping aliases on cloud alias route", async () => {
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn().mockResolvedValue(true),
      getModelAliases: vi.fn(),
      setModelAlias: vi.fn(),
      parseBearerToken: vi.fn(() => "valid"),
    }));

    const { PUT } = await import("@/app/api/cloud/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/cloud/models/alias", {
      method: "PUT",
      headers: { authorization: "Bearer valid" },
      body: JSON.stringify({ model: "openclaw", alias: "openclaw" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toMatch(/must be different/i);
  });
  it("trims aliases before deleting on local alias route", async () => {
    const deleteModelAlias = vi.fn().mockResolvedValue(true);
    vi.doMock("@/lib/localDb", () => ({
      getModelAliases: vi.fn(),
      setModelAlias: vi.fn(),
      deleteModelAlias,
    }));

    const { DELETE } = await import("@/app/api/models/alias/route");
    const response = await DELETE(new Request("http://localhost/api/models/alias?alias=%20smart%20"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, alias: "smart" });
    expect(deleteModelAlias).toHaveBeenCalledWith("smart");
  });

  it("trims aliases before resolving cloud model aliases", async () => {
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn().mockResolvedValue(true),
      getModelAliases: vi.fn().mockResolvedValue({ smart: "xlabrouter/openclaw" }),
      parseBearerToken: vi.fn(() => "valid"),
    }));

    const { POST } = await import("@/app/api/cloud/model/resolve/route");
    const response = await POST(new Request("http://localhost/api/cloud/model/resolve", {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({ alias: " smart " }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ alias: "smart", provider: "xlabrouter", model: "openclaw" });
  });

  it("returns aliases sorted by key on local alias route", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getModelAliases: vi.fn().mockResolvedValue({
        zebra: "z/model",
        alpha: "a/model",
        middle: "m/model",
      }),
      setModelAlias: vi.fn(),
      deleteModelAlias: vi.fn(),
    }));

    const { GET } = await import("@/app/api/models/alias/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(data.aliases)).toEqual(["alpha", "middle", "zebra"]);
  });

  it("rejects aliases containing control characters", async () => {
    const setModelAlias = vi.fn().mockResolvedValue(false);
    vi.doMock("@/lib/localDb", () => ({
      getModelAliases: vi.fn(),
      setModelAlias,
      deleteModelAlias: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/models/alias", {
      method: "PUT",
      body: JSON.stringify({ model: "xlabrouter/openclaw", alias: "smart\nadmin" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/invalid model or alias/i);
    expect(setModelAlias).toHaveBeenCalledWith("smart\nadmin", "xlabrouter/openclaw");
  });

  it("rejects models containing control characters on cloud alias route", async () => {
    const setModelAlias = vi.fn().mockResolvedValue(false);
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn().mockResolvedValue(true),
      getModelAliases: vi.fn().mockResolvedValue({}),
      setModelAlias,
      parseBearerToken: vi.fn(() => "valid"),
    }));

    const { PUT } = await import("@/app/api/cloud/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/cloud/models/alias", {
      method: "PUT",
      headers: { authorization: "Bearer valid" },
      body: JSON.stringify({ model: "xlabrouter/openclaw\n", alias: "smart" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toMatch(/invalid model or alias/i);
    expect(setModelAlias).toHaveBeenCalledWith("smart", "xlabrouter/openclaw");
  });

  it("rejects aliases containing control characters on cloud resolve route", async () => {
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn().mockResolvedValue(true),
      getModelAliases: vi.fn().mockResolvedValue({}),
      parseBearerToken: vi.fn(() => "valid"),
    }));

    const { POST } = await import("@/app/api/cloud/model/resolve/route");
    const response = await POST(new Request("http://localhost/api/cloud/model/resolve", {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({ alias: "smart\nadmin" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toMatch(/invalid alias/i);
  });

  it("returns not found for malformed resolved alias payloads", async () => {
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn().mockResolvedValue(true),
      getModelAliases: vi.fn().mockResolvedValue({ smart: "broken/" }),
      parseBearerToken: vi.fn(() => "valid"),
    }));

    const { POST } = await import("@/app/api/cloud/model/resolve/route");
    const response = await POST(new Request("http://localhost/api/cloud/model/resolve", {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({ alias: "smart" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.message).toMatch(/alias not found/i);
  });

});
