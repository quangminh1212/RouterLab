import fs from "node:fs/promises";
import path from "node:path";

const OPENAI_PLUGINS_REPO = "https://github.com/openai/plugins";
const OPENAI_PLUGINS_RAW = "https://raw.githubusercontent.com/openai/plugins/main";
const MARKETPLACE_URL = `${OPENAI_PLUGINS_RAW}/.agents/plugins/marketplace.json`;
const GITHUB_COPILOT_REPO = "https://github.com/github/awesome-copilot";
const GITHUB_COPILOT_RAW = "https://raw.githubusercontent.com/github/awesome-copilot/main";
const GITHUB_COPILOT_MARKETPLACE_URL = `${GITHUB_COPILOT_RAW}/.github/plugin/marketplace.json`;
const OPENAI_SOURCE_ID = "openai-curated";
const OPENAI_SOURCE_LABEL = "OpenAI Codex";
const GITHUB_COPILOT_SOURCE_ID = "github-awesome-copilot";
const GITHUB_COPILOT_SOURCE_LABEL = "GitHub Awesome Copilot";
const CACHE_TTL_MS = 10 * 60 * 1000;
const ICONS_PUBLIC_DIR = path.join(process.cwd(), "public", "plugins", "icons");
const DEFAULT_LOCAL_ICON_URL = "/plugins/icons/chatgpt-apps.svg";

let catalogCache = null;

const DISPLAY_NAME_OVERRIDES = {
  aws: "AWS",
  aws_skills: "AWS Skills",
  azure: "Azure",
  box: "Box",
  brex: "Brex",
  circleci: "CircleCI",
  cloudflare: "Cloudflare",
  datadog: "Datadog",
  figma: "Figma",
  github: "GitHub",
  gitlab: "GitLab",
  gmail: "Gmail",
  google_drive: "Google Drive",
  linear: "Linear",
  notion: "Notion",
  slack: "Slack",
  stripe: "Stripe",
  vercel: "Vercel",
};

function titleCaseName(value = "") {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function humanizeName(value = "") {
  const rawName = String(value).trim();
  const key = rawName.toLowerCase().replace(/[-\s]+/g, "_");
  if (DISPLAY_NAME_OVERRIDES[key]) return DISPLAY_NAME_OVERRIDES[key];
  return titleCaseName(rawName);
}

function safeSlug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plugin";
}

function pluginDirectory(plugin) {
  const sourcePath = typeof plugin?.source?.path === "string" ? plugin.source.path : "";
  return sourcePath.replace(/^\.\/plugins\//, "").replace(/^plugins\//, "") || plugin.name || "";
}

function githubCopilotPluginDirectory(plugin) {
  const source = plugin?.source;
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && typeof source.path === "string") {
    return source.path.replace(/^\.\/plugins\//, "").replace(/^plugins\//, "");
  }
  return plugin?.name || "";
}

function extensionFromContentType(contentType = "") {
  const normalized = String(contentType).toLowerCase();
  if (normalized.includes("image/svg")) return "svg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/x-icon") || normalized.includes("image/vnd.microsoft.icon")) return "ico";
  if (normalized.includes("image/jpeg")) return "jpg";
  return "png";
}

function extensionFromUrl(url = "") {
  const base = String(url).split("?")[0];
  const ext = path.extname(base).toLowerCase();
  if ([".svg", ".png", ".webp", ".ico", ".jpg", ".jpeg"].includes(ext)) {
    return ext.replace(/^\./, "").replace("jpeg", "jpg");
  }
  return "";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchPluginManifest(pluginDir) {
  if (!pluginDir) return null;
  try {
    return await fetchJson(`${OPENAI_PLUGINS_RAW}/plugins/${pluginDir}/.codex-plugin/plugin.json`);
  } catch {
    return null;
  }
}

async function writeIconLocal(pluginId, remoteUrl) {
  if (!remoteUrl || !/^https?:\/\//i.test(remoteUrl)) return "";
  return remoteUrl;
}

function normalizePlugin(plugin, manifest) {
  const pluginDir = pluginDirectory(plugin);
  const manifestInterface = manifest?.interface && typeof manifest.interface === "object" ? manifest.interface : {};
  const displayName = manifestInterface.displayName || manifest?.name || humanizeName(plugin.name);
  const description = manifestInterface.shortDescription || manifest?.description || `${displayName} plugin for Codex.`;
  const category = manifestInterface.category || plugin.category || "Other";
  const iconPath = manifestInterface.logo || manifestInterface.composerIcon || "./assets/app-icon.png";
  const remoteIconUrl = iconPath.startsWith("http")
    ? iconPath
    : `${OPENAI_PLUGINS_RAW}/plugins/${pluginDir}/${iconPath.replace(/^\.\//, "")}`;
  const homepage = manifestInterface.websiteURL || manifest?.homepage || `${OPENAI_PLUGINS_REPO}/tree/main/plugins/${pluginDir}`;

  return {
    pluginId: plugin.name || pluginDir,
    name: displayName,
    description,
    category,
    source: OPENAI_SOURCE_LABEL,
    sourceLabel: OPENAI_SOURCE_LABEL,
    sourceId: OPENAI_SOURCE_ID,
    sourceUrl: `${OPENAI_PLUGINS_REPO}/tree/main/plugins/${pluginDir}`,
    homepage,
    iconUrl: remoteIconUrl,
    tags: Array.isArray(manifest?.keywords) ? manifest.keywords.filter((tag) => typeof tag === "string") : [],
    installPolicy: plugin?.policy?.installation || "AVAILABLE",
    authPolicy: plugin?.policy?.authentication || "ON_INSTALL",
  };
}

function normalizeGithubCopilotPlugin(plugin) {
  const pluginDir = githubCopilotPluginDirectory(plugin);
  const sourceRepo = typeof plugin?.source?.repo === "string" ? plugin.source.repo : "";
  const homepage = plugin.homepage || (sourceRepo ? `https://github.com/${sourceRepo}` : `${GITHUB_COPILOT_REPO}/tree/main/plugins/${pluginDir}`);

  return {
    pluginId: plugin.name || pluginDir,
    name: humanizeName(plugin.name || pluginDir),
    description: plugin.description || `${humanizeName(plugin.name || pluginDir)} plugin for GitHub Copilot.` ,
    category: "GitHub Copilot",
    source: GITHUB_COPILOT_SOURCE_LABEL,
    sourceLabel: GITHUB_COPILOT_SOURCE_LABEL,
    sourceId: GITHUB_COPILOT_SOURCE_ID,
    sourceUrl: `${GITHUB_COPILOT_REPO}/tree/main/plugins/${pluginDir}`,
    homepage,
    iconUrl: DEFAULT_LOCAL_ICON_URL,
    tags: Array.isArray(plugin.keywords) ? plugin.keywords.filter((tag) => typeof tag === "string") : [],
    installPolicy: "AVAILABLE",
    authPolicy: "ON_INSTALL",
  };
}

async function loadGithubCopilotCatalog() {
  const marketplace = await fetchJson(GITHUB_COPILOT_MARKETPLACE_URL);
  const marketplacePlugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];

  return {
    plugins: marketplacePlugins.map(normalizeGithubCopilotPlugin),
    sources: [{ id: GITHUB_COPILOT_SOURCE_ID, label: GITHUB_COPILOT_SOURCE_LABEL, url: GITHUB_COPILOT_MARKETPLACE_URL }],
  };
}

async function loadOpenAiCatalog() {
  const now = Date.now();
  if (catalogCache && now - catalogCache.createdAt < CACHE_TTL_MS) return catalogCache.data;

  const marketplace = await fetchJson(MARKETPLACE_URL);
  const marketplacePlugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const manifests = [];
  const batchSize = 6;
  for (let index = 0; index < marketplacePlugins.length; index += batchSize) {
    const batch = marketplacePlugins.slice(index, index + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((plugin) => fetchPluginManifest(pluginDirectory(plugin)))
    );
    manifests.push(...batchResults);
  }

  const plugins = marketplacePlugins.map((plugin, index) => {
    const manifestResult = manifests[index];
    const manifest = manifestResult.status === "fulfilled" ? manifestResult.value : null;
    return normalizePlugin(plugin, manifest);
  });

  const pluginsWithLocalIcons = [];
  for (const plugin of plugins) {
    const localIconUrl = await writeIconLocal(plugin.pluginId, plugin.iconUrl);
    pluginsWithLocalIcons.push({
      ...plugin,
      iconUrl: localIconUrl || plugin.iconUrl || DEFAULT_LOCAL_ICON_URL,
    });
  }

  const data = {
    plugins: pluginsWithLocalIcons,
    sources: [{ id: OPENAI_SOURCE_ID, label: OPENAI_SOURCE_LABEL, url: MARKETPLACE_URL }],
  };
  catalogCache = { createdAt: now, data };
  return data;
}

export async function GET() {
  const results = await Promise.allSettled([loadOpenAiCatalog(), loadGithubCopilotCatalog()]);
  const catalogs = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason?.message || "Failed to fetch plugin source");

  if (catalogs.length === 0) {
    return Response.json({ error: errors[0] || "Failed to fetch plugin catalog" }, { status: 500 });
  }

  return Response.json({
    plugins: catalogs.flatMap((catalog) => catalog.plugins || []),
    sources: catalogs.flatMap((catalog) => catalog.sources || []),
    errors,
  });
}
