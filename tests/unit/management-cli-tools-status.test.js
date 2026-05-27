import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management cli tools status API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("allows localhost and proxies cli tools status payload", async () => {
    vi.doMock("@/app/api/cli-tools/all-statuses/route", () => ({
      GET: vi.fn(async () => Response.json({
        summary: { total: 2, ok: 2, failed: 0, installed: 1, notInstalled: 1 },
        tools: {
          claude: { ok: true, status: 200, data: { installed: true } },
          codex: { ok: true, status: 200, data: { installed: false } },
        },
      }, { status: 200 })),
    }));

    const { GET } = await import("@/app/api/management/cli-tools/status/route");
    const response = await GET(new Request("http://localhost/api/management/cli-tools/status", {
      headers: { host: "localhost" },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.total).toBe(2);
    expect(data.tools.claude.data.installed).toBe(true);
  });

  it("rejects non-localhost requests", async () => {
    vi.doMock("@/app/api/cli-tools/all-statuses/route", () => ({
      GET: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/cli-tools/status/route");
    const response = await GET(new Request("http://example.com/api/management/cli-tools/status", {
      headers: { host: "example.com" },
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
