import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidJsonRequest = (url) => new Request(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "not-json",
});

describe("cli tools settings json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/cli-tools/codex-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    vi.doMock("confbox", () => ({ parseTOML: vi.fn(), stringifyTOML: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/_lib/cliInstalled", () => ({ isCliInstalled: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/codex-settings/route");
    const response = await POST(invalidJsonRequest("http://localhost/api/cli-tools/codex-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/cli-tools/hermes-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/_lib/cliInstalled", () => ({ isCliInstalled: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/hermes-settings/route");
    const response = await POST(invalidJsonRequest("http://localhost/api/cli-tools/hermes-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/cli-tools/droid-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/_lib/cliInstalled", () => ({ isCliInstalled: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/droid-settings/route");
    const response = await POST(invalidJsonRequest("http://localhost/api/cli-tools/droid-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/cli-tools/copilot-settings rejects invalid json", async () => {
    vi.doMock("fs/promises", () => ({ default: {}, readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/copilot-settings/route");
    const response = await POST(invalidJsonRequest("http://localhost/api/cli-tools/copilot-settings"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
