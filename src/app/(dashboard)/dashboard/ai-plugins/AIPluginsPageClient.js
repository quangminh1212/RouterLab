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

const SOURCE_OPTIONS = [
  { id: "all", label: "All sources" },
  { id: "xlab-official", label: "XLab official" },
  { id: "community", label: "Community" },
];

const LOCAL_PLUGIN_CATALOG = [
  {
    pluginId: "build-web-apps",
    name: "Build Web Apps",
    category: "Coding",
    source: "xlab-official",
    description: "Build frontend/backends quickly with reusable web app workflows.",
    tags: ["web", "frontend", "backend"],
    icon: "language",
  },
  {
    pluginId: "github-tools",
    name: "GitHub",
    category: "Coding",
    source: "xlab-official",
    description: "Triage PRs, issues, CI checks, and release workflows.",
    tags: ["github", "git", "pr"],
    icon: "code",
  },
  {
    pluginId: "circleci-tools",
    name: "CircleCI",
    category: "Coding",
    source: "xlab-official",
    description: "Build, test, and deploy applications from local workflows.",
    tags: ["ci", "pipeline", "deploy"],
    icon: "account_tree",
  },
  {
    pluginId: "plugin-eval",
    name: "Plugin Eval",
    category: "Coding",
    source: "xlab-official",
    description: "Evaluate plugin quality and benchmark flows directly from chat.",
    tags: ["eval", "benchmark", "quality"],
    icon: "experiment",
  },
  {
    pluginId: "game-studio",
    name: "Game Studio",
    category: "Coding",
    source: "xlab-official",
    description: "Design, prototype, and ship browser games with guided flows.",
    tags: ["game", "prototype", "web"],
    icon: "sports_esports",
  },
  {
    pluginId: "build-ios-apps",
    name: "Build iOS Apps",
    category: "Coding",
    source: "xlab-official",
    description: "Build, refine, and debug iOS apps with local toolchains.",
    tags: ["ios", "swift", "xcode"],
    icon: "phone_iphone",
  },
  {
    pluginId: "build-macos-apps",
    name: "Build macOS Apps",
    category: "Coding",
    source: "xlab-official",
    description: "Build and maintain macOS apps with desktop-focused workflows.",
    tags: ["macos", "swift", "desktop"],
    icon: "laptop_mac",
  },
  {
    pluginId: "build-android-apps",
    name: "Test Android Apps",
    category: "Coding",
    source: "xlab-official",
    description: "Run Android emulator tests, snapshots, and QA checks quickly.",
    tags: ["android", "test", "mobile"],
    icon: "android",
  },
  {
    pluginId: "cloudflare-tools",
    name: "Cloudflare",
    category: "Infrastructure",
    source: "community",
    description: "Deploy edge workflows and inspect Cloudflare project settings.",
    tags: ["cloudflare", "edge", "infra"],
    icon: "cloud",
  },
  {
    pluginId: "sentry-tools",
    name: "Sentry",
    category: "Infrastructure",
    source: "community",
    description: "Inspect production error events and triage issues.",
    tags: ["sentry", "monitoring", "errors"],
    icon: "warning",
  },
  {
    pluginId: "netlify-tools",
    name: "Netlify",
    category: "Infrastructure",
    source: "community",
    description: "Deploy projects and manage release promotion flows.",
    tags: ["netlify", "deploy", "hosting"],
    icon: "public",
  },
  {
    pluginId: "vercel-tools",
    name: "Vercel",
    category: "Infrastructure",
    source: "community",
    description: "Build and deploy web apps and agents with project insights.",
    tags: ["vercel", "deploy", "hosting"],
    icon: "rocket_launch",
  },
  {
    pluginId: "notion-tools",
    name: "Notion",
    category: "Productivity",
    source: "community",
    description: "Search and organize project notes, docs, and references.",
    tags: ["notion", "docs", "knowledge"],
    icon: "sticky_note_2",
  },
  {
    pluginId: "google-drive-tools",
    name: "Google Drive",
    category: "Productivity",
    source: "community",
    description: "Access Drive files and summarize docs for task context.",
    tags: ["drive", "docs", "files"],
    icon: "folder",
  },
  {
    pluginId: "outlook-mail-tools",
    name: "Outlook Email",
    category: "Productivity",
    source: "community",
    description: "Triage inbox threads and draft replies with local context.",
    tags: ["email", "outlook", "inbox"],
    icon: "mail",
  },
  {
    pluginId: "stripe-tools",
    name: "Stripe",
    category: "Productivity",
    source: "community",
    description: "Inspect payment objects and business events from one place.",
    tags: ["payments", "billing", "finance"],
    icon: "payments",
  },
  {
    pluginId: "jira-tools",
    name: "Jira",
    category: "Productivity",
    source: "community",
    description: "Plan sprint work, track tickets, and summarize progress.",
    tags: ["jira", "tickets", "agile"],
    icon: "checklist",
  },
  {
    pluginId: "slack-tools",
    name: "Slack",
    category: "Productivity",
    source: "community",
    description: "Read threads and manage channel summaries for follow-up.",
    tags: ["slack", "chat", "team"],
    icon: "chat",
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
    source: plugin.source,
    category: plugin.category,
    description: plugin.description,
  };
}

export default function AIPluginsPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("xlab-official");
  const [categoryFilter, setCategoryFilter] = useState("all");
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

  const categoryOptions = useMemo(() => {
    const sourceFiltered = sourceFilter === "all" ? LOCAL_PLUGIN_CATALOG : LOCAL_PLUGIN_CATALOG.filter((item) => item.source === sourceFilter);
    return ["all", ...Array.from(new Set(sourceFiltered.map((plugin) => plugin.category))).sort()];
  }, [sourceFilter]);

  const filteredPlugins = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return LOCAL_PLUGIN_CATALOG.filter((plugin) => {
      const matchesSource = sourceFilter === "all" || plugin.source === sourceFilter;
      const matchesCategory = categoryFilter === "all" || plugin.category === categoryFilter;
      const text = `${plugin.name} ${plugin.description} ${plugin.category} ${plugin.tags.join(" ")}`.toLowerCase();
      return matchesSource && matchesCategory && (!keyword || text.includes(keyword));
    });
  }, [categoryFilter, query, sourceFilter]);

  const groupedPlugins = useMemo(() => {
    const groups = new Map();
    for (const plugin of filteredPlugins) {
      if (!groups.has(plugin.category)) groups.set(plugin.category, []);
      groups.get(plugin.category).push(plugin);
    }
    return Array.from(groups.entries());
  }, [filteredPlugins]);

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
        message: isEnabled ? `Disabled ${plugin.name}` : `Enabled ${plugin.name}`,
      });
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
          <p className="text-text-muted mt-2">Enable plugins directly in XLab Router. No store sync, no CLI sync.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            className="flex-1 min-w-[260px]"
            label="Search plugins"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins"
          />

          <div className="min-w-[220px]">
            <label className="text-sm font-medium text-text-main">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCategoryFilter("all");
              }}
              className="mt-2 w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm text-text-main outline-none focus:border-primary dark:border-white/10"
            >
              {SOURCE_OPTIONS.map((item) => (
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
              onChange={(e) => setCategoryFilter(e.target.value)}
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
            <p className="text-sm font-medium text-text-main">{enabledPluginIds.size}/{LOCAL_PLUGIN_CATALOG.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-xl border border-black/10 dark:border-white/10" />
            <div className="h-20 rounded-xl border border-black/10 dark:border-white/10" />
            <div className="h-20 rounded-xl border border-black/10 dark:border-white/10" />
          </div>
        ) : groupedPlugins.length === 0 ? (
          <div className="rounded-xl border border-black/10 p-5 text-sm text-text-muted dark:border-white/10">No plugins match current filters.</div>
        ) : (
          <div className="space-y-8">
            {groupedPlugins.map(([category, items]) => (
              <section key={category} className="space-y-3">
                <h2 className="text-[30px] font-semibold text-text-main">{category}</h2>
                <div className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
                  {items.map((plugin) => {
                    const enabled = enabledPluginIds.has(plugin.pluginId);
                    const saving = savingPluginId === plugin.pluginId;
                    return (
                      <div key={plugin.pluginId} className="flex items-start gap-4 px-4 py-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/5 text-text-main dark:bg-white/10">
                          <span className="material-symbols-outlined text-[20px]">{plugin.icon}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold text-text-main">{plugin.name}</p>
                          <p className="text-sm text-text-muted line-clamp-2">{plugin.description}</p>
                        </div>

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
