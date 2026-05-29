import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidPost = (url) => new Request(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "not-json",
});

const invalidPatch = (url) => new Request(url, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: "not-json",
});

describe("cli tools extended settings json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/cli-tools/claude-settings rejects invalid json", async () => {
    vi.doMock("child_process", () => ({ execFile: vi.fn() }));
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/_lib/cliInstalled", () => ({ isCliInstalled: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/claude-settings/route");
    const response = await POST(invalidPost("http://localhost/api/cli-tools/claude-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/cli-tools/openclaw-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/_lib/cliInstalled", () => ({ isCliInstalled: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/openclaw-settings/route");
    const response = await POST(invalidPost("http://localhost/api/cli-tools/openclaw-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/cli-tools/opencode-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/_lib/cliInstalled", () => ({ isCliInstalled: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/opencode-settings/route");
    const response = await POST(invalidPost("http://localhost/api/cli-tools/opencode-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PATCH /api/cli-tools/opencode-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/_lib/cliInstalled", () => ({ isCliInstalled: vi.fn() }));
    const { PATCH } = await import("@/app/api/cli-tools/opencode-settings/route");
    const response = await PATCH(invalidPatch("http://localhost/api/cli-tools/opencode-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
