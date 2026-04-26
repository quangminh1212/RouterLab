import { NextResponse } from "next/server";

const OFFICIAL_REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers";
const SMITHERY_REGISTRY_URL = "https://api.smithery.ai/servers";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSlug(value, fallback) {
  const source = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return (source || "mcp-server").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "mcp-server";
}

function matchesQuery(item, query) {
  if (!query) return true;
  const haystack = [item.name, item.description, item.source, item.packageName, item.sourceUrl, item.endpoint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function normalizeOfficialServer(raw) {
  const server = asObject(raw?.server);
  const metadata = asObject(raw?._meta?.["io.modelcontextprotocol.registry/official"]);
  const remote = Array.isArray(server.remotes) ? server.remotes.find((item) => typeof item?.url === "string" && item.url.trim()) : null;
  const packages = Array.isArray(server.packages) ? server.packages : [];
  const npmPackage = packages.find((item) => item?.registry_name === "npm" || item?.registry === "npm" || item?.package_type === "npm");
  const repository = asObject(server.repository);
  const name = typeof server.title === "string" && server.title.trim() ? server.title.trim() : server.name;
  const packageName = typeof npmPackage?.name === "string" ? npmPackage.name : "";
  const endpoint = typeof remote?.url === "string" ? remote.url.trim() : "";

  return {
    id: `official:${server.name || name || endpoint}`,
    name: name || server.name || endpoint || "Official MCP Server",
    description: typeof server.description === "string" ? server.description : "",
    source: "Official MCP Registry",
    registry: "official",
    packageName,
    command: packageName ? "npx" : "",
    args: packageName ? ["-y", `${packageName}@latest`] : [],
    endpoint,
    sourceUrl: typeof repository.url === "string" ? repository.url : "https://registry.modelcontextprotocol.io",
    verified: metadata.status === "active",
    latest: metadata.isLatest === true,
    installHint: packageName ? `npm i ${packageName}` : endpoint,
  };
}

function normalizeSmitheryServer(raw) {
  const server = asObject(raw);
  const qualifiedName = typeof server.qualifiedName === "string" ? server.qualifiedName : "";
  const displayName = typeof server.displayName === "string" && server.displayName.trim() ? server.displayName.trim() : qualifiedName;
  const endpoint = server.remote && qualifiedName ? `https://server.smithery.ai/${qualifiedName}/mcp` : "";
  return {
    id: `smithery:${qualifiedName || server.id || displayName}`,
    name: displayName || "Smithery MCP Server",
    description: typeof server.description === "string" ? server.description : "",
    source: "Smithery Registry",
    registry: "smithery",
    packageName: "",
    command: "",
    args: [],
    endpoint,
    sourceUrl: typeof server.homepage === "string" && server.homepage.trim() ? server.homepage.trim() : `https://smithery.ai/server/${qualifiedName}`,
    verified: server.verified === true,
    latest: true,
    installHint: endpoint || `smithery:${qualifiedName}`,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function searchOfficial(query) {
  const payload = await fetchJson(OFFICIAL_REGISTRY_URL);
  const items = Array.isArray(payload?.servers) ? payload.servers : [];
  const latestByName = new Map();

  for (const item of items) {
    const normalized = normalizeOfficialServer(item);
    if (!normalized.name && !normalized.endpoint && !normalized.packageName) continue;
    const key = normalized.id.replace(/^official:/, "");
    if (!latestByName.has(key) || normalized.latest) latestByName.set(key, normalized);
  }

  return [...latestByName.values()].filter((item) => matchesQuery(item, query));
}

async function searchSmithery(query) {
  const payload = await fetchJson(SMITHERY_REGISTRY_URL);
  const items = Array.isArray(payload?.servers) ? payload.servers : [];
  return items.map(normalizeSmitheryServer).filter((item) => matchesQuery(item, query));
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    const settled = await Promise.allSettled([searchOfficial(query), searchSmithery(query)]);
    const results = settled.flatMap((item) => (item.status === "fulfilled" ? item.value : []));
    const unique = new Map();

    for (const item of results) {
      const key = item.endpoint || item.packageName || item.id;
      if (!unique.has(key)) unique.set(key, item);
    }

    const sorted = [...unique.values()].sort((a, b) => Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name));
    const sources = settled.map((item, index) => ({
      name: index === 0 ? "Official MCP Registry" : "Smithery Registry",
      ok: item.status === "fulfilled",
      count: item.status === "fulfilled" ? item.value.length : 0,
      error: item.status === "rejected" ? item.reason?.message || "Failed" : "",
    }));

    return NextResponse.json({ results: sorted.slice(0, 100), sources });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "MCP registry search failed" }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return POST(new Request(request.url, {
    method: "POST",
    body: JSON.stringify({ query: searchParams.get("q") || "" }),
  }));
}
