import { beforeEach, describe, expect, it, vi } from "vitest";

describe("audio speech/transcriptions route guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("/v1/audio/speech rejects invalid json", async () => {
    vi.doMock("@/sse/handlers/tts.js", () => ({ handleTts: vi.fn() }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    const { POST } = await import("@/app/api/v1/audio/speech/route");
    const response = await POST(new Request("http://localhost/v1/audio/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
  });

  it("/v1/audio/speech normalizes model before forwarding", async () => {
    const handleTts = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.doMock("@/sse/handlers/tts.js", () => ({ handleTts }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    const { POST } = await import("@/app/api/v1/audio/speech/route");
    await POST(new Request("http://localhost/v1/audio/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "  openai/voice  ", input: "hi" }),
    }));
    await expect(handleTts.mock.calls[0][0].json()).resolves.toMatchObject({ model: "openai/voice", input: "hi" });
  });

  it("/v1/audio/transcriptions rejects invalid json", async () => {
    vi.doMock("@/sse/handlers/stt.js", () => ({ handleStt: vi.fn() }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    const { POST } = await import("@/app/api/v1/audio/transcriptions/route");
    const response = await POST(new Request("http://localhost/v1/audio/transcriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
  });

  it("/v1/audio/transcriptions trims url before forwarding", async () => {
    const handleStt = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.doMock("@/sse/handlers/stt.js", () => ({ handleStt }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    const { POST } = await import("@/app/api/v1/audio/transcriptions/route");
    await POST(new Request("http://localhost/v1/audio/transcriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openai/stt", url: "  https://example.com/audio.mp3  " }),
    }));
    await expect(handleStt.mock.calls[0][0].json()).resolves.toMatchObject({ model: "openai/stt", url: "https://example.com/audio.mp3" });
  });
});
