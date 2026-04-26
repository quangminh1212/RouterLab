"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardSkeleton, Input, Toggle } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
  selectedPlugins: [],
};

const LOCAL_PLUGIN_CATALOG = [
  {
    pluginId: "web-browser",
    name: "Web Browser",
    category: "Browser",
    description: "Browse pages, inspect content, and use live websites from inside XLab Router.",
    tags: ["browser", "web", "automation"],
    homepage: "https://playwright.dev",
  },
  {
    pluginId: "github-tools",
    name: "GitHub Tools",
    category: "Development",
    description: "Work with repositories, issues, pull requests, code search, and release metadata.",
    tags: ["github", "git", "code"],
    homepage: "https://github.com",
  },
  {
    pluginId: "filesystem-tools",
    name: "Filesystem Tools",
    category: "Local",
    description: "Read, organize, and edit local project files with explicit local XLab Router settings.",
    tags: ["files", "local", "workspace"],
    homepage: "https://modelcontextprotocol.io",
  },
  {
    pluginId: "memory-notes",
    name: "Memory Notes",
    category: "Productivity",
    description: "Keep reusable project notes and user preferences available for local workflows.",
    tags: ["memory", "notes", "context"],
    homepage: "https://modelcontextprotocol.io",
  },
  {
    pluginId: "docs-search",
    name: "Docs Search",
    category: "Research",
    description: "Search framework and API documentation quickly while building features.",
    tags: ["docs", "search", "developer"],
    homepage: "https://context7.com",
  },
  {
    pluginId: "web-search",
    name: "Web Search",
    category: "Research",
    description: "Find current public information and useful references for implementation work.",
    tags: ["search", "research", "web"],
    homepage: "https://duckduckgo.com",
  },
  {
    pluginId: "code-review",
    name: "Code Review",
    category: "Quality",
    description: "Review changed code for maintainability, risk, and consistency before release.",
    tags: ["review", "quality", "lint"],
    homepage: "https://docs.github.com/pull-requests",
  },
  {
    pluginId: "test-runner",
    name: "Test Runner",
    category: "Quality",
    description: "Run common local test/build commands and summarize failures in one place.",
    tags: ["test", "build", "ci"],
    homepage: "https://nodejs.org",
  },
  {
    pluginId: "database-tools",
    name: "Database Tools",
    category: "Data",
    description: "Prepare database connection helpers for local SQL and app data workflows.",
    tags: ["database", "sql", "data"],
    homepage: "https://www.postgresql.org",
  },
  {
    pluginId: "api-client",
    name: "API Client",
    category: "Development",
    description: "Call HTTP APIs, inspect responses, and reuse request snippets during development.",
    tags: ["api", "http", "debug"],
    homepage: "https://developer.mozilla.org/docs/Web/HTTP",
  },
  {
    pluginId: "security-scan",
    name: "Security Scan",
    category: "Security",
    description: "Check dependency and source-code risks before packaging or publishing.",
    tags: ["security", "scan", "audit"],
    homepage: "https://snyk.io",
  },
  {
    pluginId: "terminal-helper",
    name: "Terminal Helper",
    category: "Local",
    description: "Run safe local shell workflows and collect command output for troubleshooting.",
    tags: ["terminal", "shell", "local"],
    homepage: "https://learn.microsoft.com/powershell",
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

function getPluginKey(item) {
  return typeof item?.pluginId === "string" ? item.pluginId : "";
}

function toSelectedPlugin(plugin) {
  return {
    pluginId: plugin.pluginId,
    name: plugin.name,
    homepage: plugin.homepage,
    category: plugin.category,
    description: plugin.description,
  };
}

export default function AIPluginsPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingPluginId, setSavingPluginId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setAiForm(cloneAiIntegrations(data?.aiIntegrations)))
      .catch(() => setStatus({ type: "error", message: "Failed to load local plugins" }))
      .finally(() => setLoading(false));
  }, []);

  const enabledPluginIds = useMemo(
    () => new Set((Array.isArray(aiForm.selectedPlugins) ? aiForm.selectedPlugins : []).map(getPluginKey).filter(Boolean)),
    [aiForm.selectedPlugins]
  );

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(LOCAL_PLUGIN_CATALOG.map((plugin) => plugin.category))).sort()],
    []
  );

  const filteredPlugins = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return LOCAL_PLUGIN_CATALOG.filter((plugin) => {
      const matchesCategory = category === "all" || plugin.category === category;
      const text = `${plugin.name} ${plugin.description} ${plugin.category} ${plugin.tags.join(" ")}`.toLowerCase();
      return matchesCategory && (!keyword || text.includes(keyword));
    });
  }, [category, query]);

  const togglePlugin = async (plugin) => {
    setSavingPluginId(plugin.pluginId);
    setStatus({ type: "", message: "" });
    try {
      const currentSelected = Array.isArray(aiForm.selectedPlugins) ? aiForm.selectedPlugins : [];
      const isEnabled = enabledPluginIds.has(plugin.pluginId);
      const selectedPlugins = isEnabled
        ? currentSelected.filter((item) => getPluginKey(item) !== plugin.pluginId)
        : [...currentSelected.filter((item) => getPluginKey(item) !== plugin.pluginId), toSelectedPlugin(plugin)];

      const nextForm = { ...aiForm, selectedPlugins };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update plugin");

      setAiForm(nextForm);
      setStatus({
        type: "success",
        message: isEnabled ? `Disabled ${plugin.name}` : `Installed and enabled ${plugin.name}`,
      });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Plugin update failed" });
    } finally {
      setSavingPluginId("");
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">AI Plugins</h1>
          <p className="text-text-muted mt-1">Enable local XLab plugins. Turning a plugin on installs it into XLab Router settings and makes it ready to use.</p>
          <p className="text-xs text-text-muted mt-2">
            <strong>Note:</strong> No plugin store is contacted and no CLI config is written.
          </p>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Local Plugin Catalog</h2>
              <p className="text-sm text-text-muted mt-1">
                Available: {LOCAL_PLUGIN_CATALOG.length}. Enabled: {enabledPluginIds.size}.
              </p>
            </div>
            <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Store-free install
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                className="flex-1 min-w-[220px]"
                label="Search plugins"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="browser, github, docs, test, security..."
              />
              <div className="flex flex-wrap gap-2">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors",
                      category === item
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-black/10 text-text-muted hover:bg-black/5 hover:text-text-main dark:border-white/10 dark:hover:bg-white/5"
                    )}
                  >
                    {item === "all" ? "All" : item}
                  </button>
                ))}
              </div>
            </div>

            {filteredPlugins.length === 0 ? (
              <p className="text-sm text-text-muted">No local plugins match this filter.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredPlugins.map((plugin) => {
                  const enabled = enabledPluginIds.has(plugin.pluginId);
                  const saving = savingPluginId === plugin.pluginId;
                  return (
                    <Card key={plugin.pluginId} className="!p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-text-main">{plugin.name}</p>
                            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-text-muted dark:bg-white/5">{plugin.category}</span>
                            {enabled ? <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-500">Enabled</span> : null}
                          </div>
                          <p className="mt-2 text-xs text-text-muted line-clamp-2">{plugin.description}</p>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {plugin.tags.map((tag) => (
                              <span key={tag} className="rounded bg-black/5 px-2 py-0.5 text-[11px] text-text-muted dark:bg-white/5">#{tag}</span>
                            ))}
                          </div>
                        </div>
                        <Toggle checked={enabled} onChange={() => togglePlugin(plugin)} disabled={saving || Boolean(savingPluginId)} size="md" />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {status.message ? <p className={cn("text-sm", status.type === "error" ? "text-red-500" : "text-green-500")}>{status.message}</p> : null}
      </div>
    </div>
  );
}
