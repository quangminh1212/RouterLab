import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management cli tool route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns proxied payload for known localhost tool", async () => {
    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({
      GET: vi.fn(async () => Response.json({ installed: true, configPath: "~/.claude/settings.json" }, { status: 200 })),
    }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));

    const { GET } = await import("@/app/api/management/cli-tools/[tool]/route");
    const response = await GET(new Request("http://localhost/api/management/cli-tools/claude", {
      headers: { host: "localhost" },
    }), {
      params: Promise.resolve({ tool: "claude" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.installed).toBe(true);
  });

  it("returns 502 when upstream tool route returns non-json", async () => {
    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({
      GET: vi.fn(async () => new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } })),
    }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn(async () => Response.json({}, { status: 200 })) }));

    const { GET } = await import("@/app/api/management/cli-tools/[tool]/route");
    const response = await GET(new Request("http://localhost/api/management/cli-tools/claude", {
      headers: { host: "localhost" },
    }), {
      params: Promise.resolve({ tool: "claude" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toMatch(/invalid upstream response/i);
  });

  it("rejects unknown tool names", async () => {
    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn() }));

    const { GET } = await import("@/app/api/management/cli-tools/[tool]/route");
    const response = await GET(new Request("http://localhost/api/management/cli-tools/unknown", {
      headers: { host: "localhost" },
    }), {
      params: Promise.resolve({ tool: "unknown" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/unknown cli tool/i);
  });

  it("rejects requests that only spoof x-forwarded-host", async () => {
    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn() }));

    const { GET } = await import("@/app/api/management/cli-tools/[tool]/route");
    const response = await GET(new Request("http://example.com/api/management/cli-tools/claude", {
      headers: {
        host: "example.com",
        "x-forwarded-host": "localhost",
      },
    }), {
      params: Promise.resolve({ tool: "claude" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });

  it("rejects non-localhost requests", async () => {
    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn() }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn() }));

    const { GET } = await import("@/app/api/management/cli-tools/[tool]/route");
    const response = await GET(new Request("http://example.com/api/management/cli-tools/claude", {
      headers: { host: "example.com" },
    }), {
      params: Promise.resolve({ tool: "claude" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
