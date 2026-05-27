import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management cli tools index API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("lists supported cli tools for localhost", async () => {
    const { GET } = await import("@/app/api/management/cli-tools/route");
    const response = await GET(new Request("http://localhost/api/management/cli-tools", {
      headers: { host: "localhost" },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(9);
    expect(data.summaryEndpoint).toBe("/api/management/cli-tools/status");
    expect(data.tools[0]).toEqual({
      id: "claude",
      statusEndpoint: "/api/management/cli-tools/claude",
    });
  });

  it("rejects non-localhost requests", async () => {
    const { GET } = await import("@/app/api/management/cli-tools/route");
    const response = await GET(new Request("http://example.com/api/management/cli-tools", {
      headers: { host: "example.com" },
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
