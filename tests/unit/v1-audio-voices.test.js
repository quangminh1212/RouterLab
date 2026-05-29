import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/audio/voices", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies voices payload with CORS headers", async () => {
    vi.doMock("@/app/api/media-providers/tts/voices/route", () => ({
      GET: vi.fn(async () => Response.json({ voices: [{ id: "voice-1" }] }, { status: 200 })),
    }));

    const { GET } = await import("@/app/api/v1/audio/voices/route");
    const request = new Request("http://localhost/api/v1/audio/voices?provider=edge-tts");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(body).toEqual({ voices: [{ id: "voice-1" }] });
  });

  it("falls back to standard error payload when backend returns non-json", async () => {
    vi.doMock("@/app/api/media-providers/tts/voices/route", () => ({
      GET: vi.fn(async () => new Response("backend exploded", { status: 502, headers: { "content-type": "text/plain" } })),
    }));

    const { GET } = await import("@/app/api/v1/audio/voices/route");
    const response = await GET(new Request("http://localhost/api/v1/audio/voices"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: {
        message: "backend exploded",
        type: "server_error",
      },
    });
  });

  it("returns CORS headers for OPTIONS", async () => {
    const { OPTIONS } = await import("@/app/api/v1/audio/voices/route");
    const response = await OPTIONS();
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
