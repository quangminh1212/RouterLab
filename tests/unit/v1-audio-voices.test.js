import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/audio/voices", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies voices payload with CORS headers", async () => {
    vi.doMock("@/app/api/media-providers/tts/voices/route", () => ({
      GET: vi.fn(async () => Response.json({
        voices: [{ id: "alloy", name: "Alloy" }],
        languages: [{ code: "en", name: "English" }],
      }, { status: 200 })),
    }));

    const { GET } = await import("@/app/api/v1/audio/voices/route");
    const request = new Request("http://localhost/api/v1/audio/voices?provider=edge-tts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.voices).toEqual([{ id: "alloy", name: "Alloy" }]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("preserves backend error status", async () => {
    vi.doMock("@/app/api/media-providers/tts/voices/route", () => ({
      GET: vi.fn(async () => Response.json({ error: "Failed to fetch voices" }, { status: 502 })),
    }));

    const { GET } = await import("@/app/api/v1/audio/voices/route");
    const response = await GET(new Request("http://localhost/api/v1/audio/voices"));
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toMatch(/failed to fetch voices/i);
  });

  it("handles CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/audio/voices/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
