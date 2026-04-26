import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getClaudeSettingsPath = () => path.join(process.cwd(), ".claude", "settings.json");

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sanitizeId(raw, fallback) {
  const candidate = typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
  return candidate.replace(/[^a-zA-Z0-9_.-]/g, "-") || fallback;
}

function normalizeStore(store, index) {
  const source = asObject(store);
  const id = sanitizeId(source.id || source.name, `store-${index + 1}`);
  const marketplace = sanitizeId(source.marketplace || id, id);
  return {
    id,
    marketplace,
    source: typeof source.source === "string" && source.source.trim() ? source.source.trim() : "url",
    repo: typeof source.repo === "string" ? source.repo.trim() : "",
    ref: typeof source.ref === "string" ? source.ref.trim() : "",
    path: typeof source.path === "string" ? source.path.trim() : "",
    endpoint: typeof source.endpoint === "string" ? source.endpoint.trim() : "",
    enabled: source.enabled === true,
  };
}

function normalizePlugin(plugin, index) {
  const source = asObject(plugin);
  const pluginId = sanitizeId(source.pluginId || source.id || source.name, `plugin-${index + 1}`);
  const marketplace = sanitizeId(source.marketplace || source.storeId || "", "");
  return {
    pluginId,
    marketplace,
    enabled: source.enabled === true,
  };
}

function toMarketplaceSource(store) {
  if (store.source === "builtin") {
    return null;
  }
  if (store.source === "github" && store.repo) {
    const source = { source: "github", repo: store.repo };
    if (store.ref) source.ref = store.ref;
    if (store.path) source.path = store.path;
    return source;
  }
  if (store.endpoint) {
    return { source: "url", url: store.endpoint };
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const stores = Array.isArray(body?.pluginStores) ? body.pluginStores.map(normalizeStore).filter((item) => item.enabled) : [];
    const plugins = Array.isArray(body?.plugins) ? body.plugins.map(normalizePlugin).filter((item) => item.enabled && item.pluginId && item.marketplace) : [];

    if (stores.length === 0 && plugins.length === 0) {
      return NextResponse.json({ error: "No enabled plugin stores or plugins to sync" }, { status: 400 });
    }

    const settingsPath = getClaudeSettingsPath();
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });

    let current = {};
    try {
      current = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    } catch {
      current = {};
    }

    const next = {
      ...asObject(current),
      extraKnownMarketplaces: { ...asObject(current.extraKnownMarketplaces) },
      enabledPlugins: { ...asObject(current.enabledPlugins) },
    };

    const marketplaceCommands = [];
    for (const store of stores) {
      const source = toMarketplaceSource(store);
      if (!source) continue;
      next.extraKnownMarketplaces[store.marketplace] = { source };
      const sourceArg = store.source === "github" && store.repo ? `${store.repo}${store.ref ? `@${store.ref}` : ""}` : store.endpoint;
      marketplaceCommands.push(`claude plugin marketplace add ${sourceArg} --scope project`);
    }

    const pluginCommands = [];
    for (const plugin of plugins) {
      const key = `${plugin.pluginId}@${plugin.marketplace}`;
      next.enabledPlugins[key] = true;
      pluginCommands.push(`claude plugin install ${key}`);
    }

    await fs.writeFile(settingsPath, JSON.stringify(next, null, 2));

    return NextResponse.json({
      success: true,
      path: settingsPath,
      syncedStores: marketplaceCommands.length,
      syncedPlugins: pluginCommands.length,
      commands: [...marketplaceCommands, ...pluginCommands],
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to sync plugins" }, { status: 500 });
  }
}
