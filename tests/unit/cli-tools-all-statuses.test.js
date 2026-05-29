import { beforeEach, describe, expect, it, vi } from "vitest";

describe("cli tools all-statuses API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("aggregates tool GET results into a single payload", async () => {
    const ok = (body) => Promise.resolve(Response.json(body, { status: 200 }));
    const fail = (body, status = 500) => Promise.resolve(Response.json(body, { status }));

    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn(() => ok({ installed: false })) }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn(() => fail({ error: "boom" }, 500)) }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn(() => ok({ installed: false })) }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn(() => ok({ running: true })) }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));

    const { GET } = await import("@/app/api/cli-tools/all-statuses/route");
    const response = await GET(new Request("http://localhost/api/cli-tools/all-statuses"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary).toEqual({
      total: 9,
      ok: 8,
      failed: 1,
      installed: 5,
      notInstalled: 2,
    });
    expect(data.tools.cowork.ok).toBe(false);
    expect(data.tools.cowork.status).toBe(500);
    expect(data.tools.claude.data.installed).toBe(true);
    expect(data.tools.mitm.data.running).toBe(true);
  });

  it("captures thrown getter errors without failing whole response", async () => {
    const ok = (body) => Promise.resolve(Response.json(body, { status: 200 }));

    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({ GET: vi.fn(() => { throw new Error("crash"); }) }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn(() => ok({ running: false })) }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));

    const { GET } = await import("@/app/api/cli-tools/all-statuses/route");
    const response = await GET(new Request("http://localhost/api/cli-tools/all-statuses"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.failed).toBe(1);
    expect(data.tools.claude.ok).toBe(false);
    expect(data.tools.claude.data.error).toMatch(/crash/i);
  });

  it("keeps aggregating when one getter returns non-json", async () => {
    const ok = (body) => Promise.resolve(Response.json(body, { status: 200 }));

    vi.doMock("@/app/api/cli-tools/claude-settings/route", () => ({ GET: vi.fn(() => new Response("plain failure", { status: 502 })) }));
    vi.doMock("@/app/api/cli-tools/codex-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/copilot-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/cowork-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/droid-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/hermes-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/antigravity-mitm/route", () => ({ GET: vi.fn(() => ok({ running: false })) }));
    vi.doMock("@/app/api/cli-tools/openclaw-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));
    vi.doMock("@/app/api/cli-tools/opencode-settings/route", () => ({ GET: vi.fn(() => ok({ installed: true })) }));

    const { GET } = await import("@/app/api/cli-tools/all-statuses/route");
    const response = await GET(new Request("http://localhost/api/cli-tools/all-statuses"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.failed).toBe(1);
    expect(data.tools.claude.status).toBe(502);
    expect(data.tools.claude.data.error).toBe("plain failure");
  });
});
