import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management disabled models API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("allows localhost reads through the internal disabled models route", async () => {
    const internalGet = vi.fn(async () => Response.json({ disabled: { openai: ["gpt-4.1"] } }));
    vi.doMock("@/app/api/models/disabled/route", () => ({
      GET: internalGet,
      POST: vi.fn(),
      DELETE: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/disabled/route");
    const request = new Request("http://localhost/api/management/models/disabled", { headers: { host: "localhost" } });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.disabled).toEqual({ openai: ["gpt-4.1"] });
    expect(internalGet).toHaveBeenCalledWith(request);
  });

  it("allows localhost writes through the internal disabled models route", async () => {
    const internalPost = vi.fn(async () => Response.json({ success: true }));
    vi.doMock("@/app/api/models/disabled/route", () => ({
      GET: vi.fn(),
      POST: internalPost,
      DELETE: vi.fn(),
    }));

    const { POST } = await import("@/app/api/management/models/disabled/route");
    const request = new Request("http://127.0.0.1/api/management/models/disabled", {
      method: "POST",
      headers: { host: "127.0.0.1" },
      body: JSON.stringify({ providerAlias: "openai", ids: ["gpt-4.1"] }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(internalPost).toHaveBeenCalledWith(request);
  });

  it("rejects non-localhost requests before calling internal routes", async () => {
    const internalDelete = vi.fn();
    vi.doMock("@/app/api/models/disabled/route", () => ({
      GET: vi.fn(),
      POST: vi.fn(),
      DELETE: internalDelete,
    }));

    const { DELETE } = await import("@/app/api/management/models/disabled/route");
    const response = await DELETE(new Request("http://example.com/api/management/models/disabled", {
      method: "DELETE",
      headers: { host: "example.com" },
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
    expect(internalDelete).not.toHaveBeenCalled();
  });
});
