"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
  selectedPlugins: [],
};

const FALLBACK_PLUGINS = [
  {
    pluginId: "github",
    name: "GitHub",
    description: "Triage PRs, issues, CI, and publish workflows.",
    category: "Coding",
    sourceId: "fallback",
    sourceLabel: "Fallback",
    iconUrl: "https://github.githubassets.com/favicons/favicon.svg",
    homepage: "https://github.com",
    sourceUrl: "https://github.com",
  },
  {
    pluginId: "vercel",
    name: "Vercel",
    description: "Build and deploy web apps and agents.",
    category: "Infrastructure",
    sourceId: "fallback",
    sourceLabel: "Fallback",
    iconUrl: "https://assets.vercel.com/image/upload/front/favicon/vercel/57x57.png",
    homepage: "https://vercel.com",
    sourceUrl: "https://vercel.com",
  },
  {
    pluginId: "sentry",
    name: "Sentry",
    description: "Inspect recent Sentry issues and events.",
    category: "Infrastructure",
    sourceId: "fallback",
    sourceLabel: "Fallback",
    iconUrl: "https://sentry-brand.storage.googleapis.com/sentry-glyph-black.png",
    homepage: "https://sentry.io",
    sourceUrl: "https://sentry.io",
  },
  {
    pluginId: "mem0",
    name: "Mem0",
    description: "Long-term AI memory platform for personalized agent experiences.",
    category: "Memory",
    sourceId: "memory",
    sourceLabel: "Memory",
    iconUrl: "https://github.com/mem0ai.png",
    homepage: "https://mem0.ai",
    sourceUrl: "https://github.com/mem0ai/mem0",
  },
  {
    pluginId: "zep",
    name: "Zep",
    description: "Memory layer for conversational assistants with retrieval APIs.",
    category: "Memory",
    sourceId: "memory",
    sourceLabel: "Memory",
    iconUrl: "https://github.com/getzep.png",
    homepage: "https://www.getzep.com",
    sourceUrl: "https://github.com/getzep/zep",
  },
  {
    pluginId: "letta",
    name: "Letta",
    description: "Stateful agents with persistent memory and tool orchestration.",
    category: "Memory",
    sourceId: "memory",
    sourceLabel: "Memory",
    iconUrl: "https://github.com/letta-ai.png",
    homepage: "https://www.letta.com",
    sourceUrl: "https://github.com/letta-ai/letta",
  },
  {
    pluginId: "langmem",
    name: "LangMem",
    description: "Memory toolkit for LLM apps with extraction and recall pipelines.",
    category: "Memory",
    sourceId: "memory",
    sourceLabel: "Memory",
    iconUrl: "https://github.com/langchain-ai.png",
    homepage: "https://www.langchain.com",
    sourceUrl: "https://github.com/langchain-ai/langmem",
  },
];

function cloneAiIntegrations(value) {
  const source = value && typeof value === "object" ? value : EMPTY_AI_INTEGRATIONS;
  return {
    enabled: source.enabled === true,
    autoConnect: source.autoConnect === true,
    mcpServers: Array.isArray(source.mcpServers) ? source.mcpServers.map((item) => ({ ...item })) : [],
    plugins: Array.isArray(source.plugins) ? source.plugins.map((item) => ({ ...item })) : [],
    selectedPlugins: Array.isArray(source.selectedPlugins) ? source.selectedPlugins.map((item) => ({ ...item })) : [],
  };
}

function normalizePlugin(item) {
  const sourceId = typeof item?.sourceId === "string" ? item.sourceId : "unknown";
  const pluginId = typeof item?.pluginId === "string" ? item.pluginId : "";
  const sourceLabel = typeof item?.sourceLabel === "string" && item.sourceLabel.trim()
    ? item.sourceLabel.trim()
    : typeof item?.source === "string" && item.source.trim()
      ? item.source.trim()
      : "";
  return {
    pluginId,
    name: typeof item?.name === "string" ? item.name : "",
    description: typeof item?.description === "string" ? item.description : "",
    category: typeof item?.category === "string" && item.category.trim() ? item.category.trim() : "Other",
    sourceId,
    uniqueKey: `${sourceId}:${pluginId}`,
    sourceLabel,
    iconUrl: typeof item?.iconUrl === "string" ? item.iconUrl : "",
    homepage: typeof item?.homepage === "string" ? item.homepage : "",
    sourceUrl: typeof item?.sourceUrl === "string" ? item.sourceUrl : "",
    tags: Array.isArray(item?.tags) ? item.tags.filter((tag) => typeof tag === "string") : [],
  };
}

function toSelectedPlugin(plugin) {
  return {
    pluginKey: plugin.uniqueKey,
    pluginId: plugin.pluginId,
    name: plugin.name,
    source: plugin.sourceLabel,
    sourceId: plugin.sourceId,
    category: plugin.category,
    description: plugin.description,
    homepage: plugin.homepage,
    sourceUrl: plugin.sourceUrl,
    iconUrl: plugin.iconUrl,
  };
}

function getPluginKey(item) {
  if (typeof item?.pluginKey === "string" && item.pluginKey) return item.pluginKey;
  if (typeof item?.sourceId === "string" && typeof item?.pluginId === "string" && item.pluginId) {
    return `${item.sourceId}:${item.pluginId}`;
  }
  return typeof item?.pluginId === "string" ? item.pluginId : "";
}

function getPluginInfoUrl(plugin) {
  const homepage = typeof plugin?.homepage === "string" ? plugin.homepage.trim() : "";
  const sourceUrl = typeof plugin?.sourceUrl === "string" ? plugin.sourceUrl.trim() : "";
  return sourceUrl || homepage || "";
}

function getFallbackIcon(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("coding") || value.includes("development")) return "code";
  if (value.includes("infrastructure") || value.includes("devops")) return "cloud";
  if (value.includes("productivity")) return "work";
  if (value.includes("security")) return "security";
  if (value.includes("data")) return "database";
  return "extension";
}

function PluginIcon({ iconUrl, category, name }) {
  const [failed, setFailed] = useState(false);
  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className="h-8 w-8 rounded-md object-cover"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }
  return <span className="material-symbols-outlined text-[20px] text-[#0F1D20]">{getFallbackIcon(category)}</span>;
}

export default function AIPluginsPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [plugins, setPlugins] = useState(() => FALLBACK_PLUGINS.map(normalizePlugin));
  const [sourceOptions, setSourceOptions] = useState([{ id: "all", label: "All sources" }]);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [savingPluginId, setSavingPluginId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    let canceled = false;

    const loadData = async () => {
      try {
        const settingsRes = await fetch("/api/settings", { cache: "no-store" });

        const settings = await settingsRes.json().catch(() => ({}));
        const nextForm = cloneAiIntegrations(settings?.aiIntegrations);
        if (!canceled) {
          setAiForm(nextForm);
          setLoading(false);
        }

        const catalogRes = await fetch("/api/ai-plugins/catalog", { cache: "no-store" });

        if (catalogRes.ok) {
          const catalog = await catalogRes.json().catch(() => ({}));
          const rawPlugins = (Array.isArray(catalog.plugins) ? catalog.plugins : [])
            .map(normalizePlugin)
            .filter((plugin) => plugin.pluginId && plugin.name);
          const nextPlugins = [];
          const seenPluginKeys = new Set();
          for (const plugin of rawPlugins) {
            if (seenPluginKeys.has(plugin.uniqueKey)) continue;
            seenPluginKeys.add(plugin.uniqueKey);
            nextPlugins.push(plugin);
          }
          const nextSources = [
            { id: "all", label: "All sources" },
            ...(Array.isArray(catalog.sources) ? catalog.sources.map((item) => ({ id: item.id, label: item.label })) : []),
          ];

          if (!canceled) {
            setPlugins(nextPlugins.length > 0 ? nextPlugins : FALLBACK_PLUGINS.map(normalizePlugin));
            setSourceOptions(nextSources.length > 1 ? nextSources : [{ id: "all", label: "All sources" }]);
            if (Array.isArray(catalog.errors) && catalog.errors.length > 0) {
              setStatus({ type: "error", message: "Some sources failed to load. Showing available plugins." });
            }
          }
        } else {
          if (!canceled) {
            setPlugins(FALLBACK_PLUGINS.map(normalizePlugin));
            setStatus({ type: "error", message: "Catalog source unavailable. Showing fallback list." });
          }
        }
      } catch {
        if (!canceled) {
          setPlugins(FALLBACK_PLUGINS.map(normalizePlugin));
          setStatus({ type: "error", message: "Failed to load plugin sources. Showing fallback list." });
        }
      } finally {
        if (!canceled) {
          setLoading(false);
          setLoadingCatalog(false);
        }
      }
    };

    loadData();
    return () => {
      canceled = true;
    };
  }, []);

  const enabledPluginIds = useMemo(
    () => new Set((Array.isArray(aiForm.selectedPlugins) ? aiForm.selectedPlugins : []).map(getPluginKey).filter(Boolean)),
    [aiForm.selectedPlugins]
  );

  const categoryOptions = useMemo(() => {
    const sourceFiltered = sourceFilter === "all" ? plugins : plugins.filter((plugin) => plugin.sourceId === sourceFilter);
    return ["all", ...Array.from(new Set(sourceFiltered.map((plugin) => plugin.category))).sort()];
  }, [plugins, sourceFilter]);

  const filteredPlugins = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return plugins.filter((plugin) => {
      const matchesSource = sourceFilter === "all" || plugin.sourceId === sourceFilter;
      const matchesCategory = categoryFilter === "all" || plugin.category === categoryFilter;
      const text = `${plugin.name} ${plugin.description} ${plugin.category} ${plugin.sourceLabel}`.toLowerCase();
      return matchesSource && matchesCategory && (!keyword || text.includes(keyword));
    });
  }, [plugins, categoryFilter, query, sourceFilter]);

  const groupedPlugins = useMemo(() => {
    const groups = new Map();
    for (const plugin of filteredPlugins) {
      if (!groups.has(plugin.category)) groups.set(plugin.category, []);
      groups.get(plugin.category).push(plugin);
    }
    return Array.from(groups.entries());
  }, [filteredPlugins]);

  const togglePlugin = async (plugin) => {
    const pluginKey = getPluginKey(plugin);
    setSavingPluginId(pluginKey);
    setStatus({ type: "", message: "" });
    try {
      const currentSelected = Array.isArray(aiForm.selectedPlugins) ? aiForm.selectedPlugins : [];
      const isEnabled = enabledPluginIds.has(pluginKey);
      const selectedPlugins = isEnabled
        ? currentSelected.filter((item) => getPluginKey(item) !== pluginKey)
        : [...currentSelected.filter((item) => getPluginKey(item) !== pluginKey), toSelectedPlugin(plugin)];

      const nextForm = { ...aiForm, selectedPlugins };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update plugin");

      setAiForm(nextForm);
      setStatus({ type: "success", message: isEnabled ? `Disabled ${plugin.name}` : `Enabled ${plugin.name}` });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Plugin update failed" });
    } finally {
      setSavingPluginId("");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[42px] leading-tight font-semibold text-text-main">Make Plugins work your way</h1>
          <p className="text-text-muted mt-2">Plugin list is pulled from OpenAI Codex and GitHub Awesome Copilot marketplaces.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            className="flex-1 min-w-[260px]"
            label="Search plugins"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search plugins"
          />

          <div className="min-w-[220px]">
            <label className="text-sm font-medium text-text-main">Source</label>
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setCategoryFilter("all");
              }}
              className="mt-2 w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm text-text-main outline-none focus:border-primary dark:border-white/10"
            >
              {sourceOptions.map((item) => (
                <option key={item.id} value={item.id} className="bg-[#111]">
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="text-sm font-medium text-text-main">Category</label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm text-text-main outline-none focus:border-primary dark:border-white/10"
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item} className="bg-[#111]">
                  {item === "all" ? "All" : item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Installed</p>
            <p className="text-sm font-medium text-text-main">{enabledPluginIds.size}/{plugins.length}</p>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>Showing {filteredPlugins.length} of {plugins.length} plugins</span>
            <span>{sourceOptions.find((item) => item.id === sourceFilter)?.label || "All sources"}</span>
          </div>
        </div>

        {loading || loadingCatalog ? (
          <div className="space-y-3">
            <div className="h-20 rounded-xl border border-black/10 dark:border-white/10" />
            <div className="h-20 rounded-xl border border-black/10 dark:border-white/10" />
            <div className="h-20 rounded-xl border border-black/10 dark:border-white/10" />
          </div>
        ) : groupedPlugins.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-5 text-sm text-text-muted dark:border-white/10">No plugins match current filters.</div>
        ) : (
          <div className="space-y-6">
            {groupedPlugins.map(([category, items]) => (
              <section key={category} className="space-y-2.5">
                <h2 className="text-[24px] font-semibold text-text-main">{category}</h2>
                <div className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
                  {items.map((plugin) => {
                    const pluginKey = getPluginKey(plugin);
                    const enabled = enabledPluginIds.has(pluginKey);
                    const saving = savingPluginId === pluginKey;
                    const infoUrl = getPluginInfoUrl(plugin);
                    return (
                      <div key={plugin.uniqueKey || pluginKey} className="flex items-start gap-3 px-3.5 py-3">
                        {infoUrl ? (
                          <a
                            href={infoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 flex-1 items-start gap-3 rounded-lg -m-1 p-1 hover:bg-black/5 dark:hover:bg-white/5"
                            title={`Open ${plugin.name} plugin information`}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
                              <PluginIcon iconUrl={plugin.iconUrl} category={plugin.category} name={plugin.name} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-base font-semibold text-text-main">{plugin.name}</p>
                                {enabled ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-500">Enabled</span> : null}
                                {plugin.sourceLabel ? (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{plugin.sourceLabel}</span>
                                ) : null}
                                <span
                                  className="rounded-full border border-black/10 px-2 py-0.5 text-[11px] text-text-muted hover:text-text-main dark:border-white/10"
                                  title="Open plugin information"
                                >
                                  info
                                </span>
                              </div>
                              <p className="text-sm text-text-muted line-clamp-2">{plugin.description || "No description"}</p>
                            </div>
                          </a>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
                              <PluginIcon iconUrl={plugin.iconUrl} category={plugin.category} name={plugin.name} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-base font-semibold text-text-main">{plugin.name}</p>
                                {enabled ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-500">Enabled</span> : null}
                                {plugin.sourceLabel ? (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{plugin.sourceLabel}</span>
                                ) : null}
                              </div>
                              <p className="text-sm text-text-muted line-clamp-2">{plugin.description || "No description"}</p>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => togglePlugin(plugin)}
                          disabled={saving || Boolean(savingPluginId)}
                          className={cn(
                            "mt-1 flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                            enabled
                              ? "border-green-500/40 bg-green-500/10 text-green-500"
                              : "border-black/20 text-text-main hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
                            (saving || Boolean(savingPluginId)) && "opacity-60"
                          )}
                          title={enabled ? "Disable plugin" : "Enable plugin"}
                        >
                          <span className="material-symbols-outlined text-[18px]">{enabled ? "check" : "add"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {status.message ? <p className={cn("text-sm", status.type === "error" ? "text-red-500" : "text-green-500")}>{status.message}</p> : null}
      </div>
    </div>
  );
}
