import { describe, expect, it, vi } from "vitest";

const settings = {
  aiIntegrations: {
    enabled: true,
    mcpServers: [
      {
        id: "context7",
        name: "Context7 Docs",
        source: "documentation",
        endpoint: "https://context7.example/mcp",
        enabled: true,
      },
      {
        id: "filesystem",
        name: "Filesystem",
        source: "local-files",
        command: "npx",
        npmPackage: "@modelcontextprotocol/server-filesystem",
        enabled: false,
      },
    ],
  },
};

vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(async () => settings),
}));

describe("MCP compatibility routes", () => {
  it("GET /api/mcp/status summarizes configured MCP servers", async () => {
    const { GET } = await import("@/app/api/mcp/status/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: "configured",
      online: true,
      enabled: true,
      transport: "http",
    });
    expect(data.servers).toEqual([
      expect.objectContaining({ id: "context7", enabled: true, transport: "http", configured: true }),
      expect.objectContaining({ id: "filesystem", enabled: false, transport: "stdio", configured: true }),
    ]);
  });

  it("GET /api/mcp/tools exposes safe tool metadata", async () => {
    const { GET } = await import("@/app/api/mcp/tools/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.tools[0]).toMatchObject({
      name: "mcp_context7",
      scopes: ["read:docs"],
      phase: "configured",
      auditLevel: "standard",
    });
    expect(data.tools[1]).toMatchObject({
      name: "mcp_filesystem",
      scopes: ["read:files"],
      phase: "available",
    });
  });
});
