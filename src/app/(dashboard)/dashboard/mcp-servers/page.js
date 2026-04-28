import dynamic from "next/dynamic";

const MCPServersPageClient = dynamic(() => import("./MCPServersPageClient"), {
  loading: () => <div className="p-6 text-sm text-text-muted">Loading MCP servers...</div>,
});

export default function MCPServersPage() {
  return <MCPServersPageClient />;
}
