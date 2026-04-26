import { NextResponse } from "next/server";

const MODEL_API_ENDPOINTS = new Set([
  "https://api.openai.com/v1/models",
  "https://api.anthropic.com/v1/messages",
  "https://generativelanguage.googleapis.com/v1beta/models",
]);

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStore(store, index) {
  const source = asObject(store);
  const id = typeof source.id === "string" && source.id.trim() ? source.id.trim() : `store-${index + 1}`;
  return {
    id,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : id,
    source: typeof source.source === "string" && source.source.trim() ? source.source.trim() : "url",
    repo: typeof source.repo === "string" ? source.repo.trim() : "",
    ref: typeof source.ref === "string" && source.ref.trim() ? source.ref.trim() : "main",
    path: typeof source.path === "string" && source.path.trim() ? source.path.trim() : ".claude-plugin/marketplace.json",
    endpoint: typeof source.endpoint === "string" ? source.endpoint.trim() : "",
    marketplace: typeof source.marketplace === "string" ? source.marketplace.trim() : id,
    enabled: source.enabled === true,
  };
}

function normalizePlugin(rawPlugin, store) {
  const plugin = asObject(rawPlugin);
  const name = typeof plugin.name === "string" && plugin.name.trim() ? plugin.name.trim() : "";
  if (!name) return null;

  const tags = Array.isArray(plugin.tags) ? plugin.tags.filter((item) => typeof item === "string") : [];
  const author = asObject(plugin.author);
  return {
    id: `${store.marketplace}:${name}`,
    pluginId: name,
    name,
    description: typeof plugin.description === "string" ? plugin.description : "",
    category: typeof plugin.category === "string" ? plugin.category : "",
    tags,
    author: typeof author.name === "string" ? author.name : "",
    homepage: typeof plugin.homepage === "string" ? plugin.homepage : "",
    marketplace: store.marketplace,
    storeId: store.id,
    storeName: store.name,
    source: plugin.source || null,
    installCommand: `claude plugin install ${name}@${store.marketplace}`,
  };
}

function matchesQuery(plugin, query) {
  if (!query) return true;
  const haystack = [plugin.name, plugin.description, plugin.category, plugin.author, plugin.storeName, ...(plugin.tags || [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function resolveStoreEndpoint(store) {
  if (store.endpoint) return store.endpoint;
  if ((store.source === "github" || store.source === "builtin") && store.repo) {
    return `https://raw.githubusercontent.com/${store.repo}/${store.ref}/${store.path}`;
  }
  return "";
}

function hasMarketplaceEndpoint(store) {
  const endpoint = resolveStoreEndpoint(store);
  return Boolean(endpoint) && !MODEL_API_ENDPOINTS.has(endpoint);
}

async function fetchMarketplace(store, query) {
  const endpoint = resolveStoreEndpoint(store);
  if (!store.enabled || !endpoint) return { store, plugins: [], error: "Missing marketplace endpoint" };

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const marketplaceName = typeof payload?.name === "string" && payload.name.trim() ? payload.name.trim() : store.marketplace;
    const resolvedStore = { ...store, marketplace: marketplaceName };
    const plugins = Array.isArray(payload?.plugins)
      ? payload.plugins.map((item) => normalizePlugin(item, resolvedStore)).filter(Boolean).filter((item) => matchesQuery(item, query))
      : [];

    return { store: resolvedStore, plugins, error: null };
  } catch (error) {
    return { store, plugins: [], error: error?.message || "Failed to load marketplace" };
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const stores = Array.isArray(body?.pluginStores) ? body.pluginStores.map(normalizeStore) : [];
    const activeStores = stores.filter((store) => store.enabled && hasMarketplaceEndpoint(store));

    if (activeStores.length === 0) {
      return NextResponse.json({ error: "No enabled plugin stores" }, { status: 400 });
    }

    const settled = await Promise.all(activeStores.map((store) => fetchMarketplace(store, query)));
    const results = settled.flatMap((item) => item.plugins).slice(0, 200);
    const storesStatus = settled.map((item) => ({
      id: item.store.id,
      name: item.store.name,
      marketplace: item.store.marketplace,
      ok: !item.error,
      count: item.plugins.length,
      error: item.error,
    }));

    return NextResponse.json({ results, stores: storesStatus });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Plugin store search failed" }, { status: 500 });
  }
}
