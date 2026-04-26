"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Input } from "@/shared/components";
import MCPServersPageClient from "../mcp-servers/MCPServersPageClient";
import AIPluginsPageClient from "../ai-plugins/AIPluginsPageClient";
import AISkillsPageClient from "../ai-skills/AISkillsPageClient";
import { cn } from "@/shared/utils/cn";

const TABS = [
  { id: "mcp", label: "MCP Servers", icon: "hub", component: MCPServersPageClient, href: "/dashboard/mcp-servers" },
  { id: "plugins", label: "AI Plugins", icon: "extension", component: AIPluginsPageClient, href: "/dashboard/ai-plugins" },
  { id: "skills", label: "AI Skills", icon: "psychology", component: AISkillsPageClient, href: "/dashboard/ai-skills" },
];

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function PowerUpPageClient() {
  const [activeTab, setActiveTab] = useState("mcp");
  const [loadingStats, setLoadingStats] = useState(true);
  const [overview, setOverview] = useState({
    enabledMcp: 0,
    totalMcp: 0,
    enabledStores: 0,
    totalStores: 0,
    mcpServers: [],
    selectedPlugins: [],
    selectedSkills: [],
  });
  const [quickQuery, setQuickQuery] = useState("");

  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.component || MCPServersPageClient;

  useEffect(() => {
    let canceled = false;
    const loadOverview = async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || canceled) return;

        const ai = data?.aiIntegrations || {};
        const mcpServers = toSafeArray(ai.mcpServers);
        const pluginStores = toSafeArray(ai.plugins);
        const selectedPlugins = toSafeArray(ai.selectedPlugins);
        const selectedSkills = toSafeArray(ai.selectedSkills);

        setOverview({
          enabledMcp: mcpServers.filter((item) => item?.enabled === true).length,
          totalMcp: mcpServers.length,
          enabledStores: pluginStores.filter((item) => item?.enabled === true).length,
          totalStores: pluginStores.length,
          mcpServers,
          selectedPlugins,
          selectedSkills,
        });
      } finally {
        if (!canceled) setLoadingStats(false);
      }
    };

    loadOverview();
    return () => {
      canceled = true;
    };
  }, []);

  const quickItems = useMemo(() => {
    return [
      ...overview.mcpServers.map((server, idx) => ({
        id: `mcp-${server?.id || idx}`,
        type: "MCP",
        label: server?.name || server?.id || `MCP #${idx + 1}`,
        searchable: `${server?.name || ""} ${server?.id || ""} ${server?.source || ""} mcp`,
        href: "/dashboard/mcp-servers",
      })),
      ...overview.selectedPlugins.map((plugin, idx) => ({
        id: `plugin-${plugin?.pluginId || idx}`,
        type: "Plugin",
        label: plugin?.name || plugin?.pluginId || `Plugin ${idx + 1}`,
        searchable: `${plugin?.name || ""} ${plugin?.pluginId || ""} ${plugin?.marketplace || ""}`,
        href: "/dashboard/ai-plugins",
      })),
      ...overview.selectedSkills.map((skill, idx) => ({
        id: `skill-${skill?.id || idx}`,
        type: "Skill",
        label: skill?.name || skill?.id || `Skill ${idx + 1}`,
        searchable: `${skill?.name || ""} ${skill?.id || ""} ${skill?.description || ""}`,
        href: "/dashboard/ai-skills",
      })),
    ];
  }, [overview]);

  const filteredQuickItems = useMemo(() => {
    const keyword = quickQuery.trim().toLowerCase();
    if (!keyword) return quickItems.slice(0, 8);
    return quickItems
      .filter((item) => item.searchable.toLowerCase().includes(keyword))
      .slice(0, 12);
  }, [quickItems, quickQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Power Up</h1>
        <p className="text-text-muted mt-1">Manage MCP servers, plugins, and skills locally inside XLab Router.</p>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-3">
            <p className="text-xs text-text-muted">MCP enabled</p>
            <p className="text-xl font-semibold text-text-main">{loadingStats ? "..." : `${overview.enabledMcp}/${overview.totalMcp}`}</p>
          </div>
          <div className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-3">
            <p className="text-xs text-text-muted">Plugin stores enabled</p>
            <p className="text-xl font-semibold text-text-main">{loadingStats ? "..." : `${overview.enabledStores}/${overview.totalStores}`}</p>
          </div>
          <div className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-3">
            <p className="text-xs text-text-muted">Selected plugins</p>
            <p className="text-xl font-semibold text-text-main">{loadingStats ? "..." : overview.selectedPlugins.length}</p>
          </div>
          <div className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-3">
            <p className="text-xs text-text-muted">Selected skills</p>
            <p className="text-xl font-semibold text-text-main">{loadingStats ? "..." : overview.selectedSkills.length}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="flex-1 min-w-[220px]"
              label="Quick search"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Find MCP / plugin / skill..."
            />
            <Link href="/dashboard/mcp-servers" className="px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5">Open MCP</Link>
            <Link href="/dashboard/ai-plugins" className="px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5">Open Plugins</Link>
            <Link href="/dashboard/ai-skills" className="px-3 py-2 rounded-lg bg-surface border border-black/10 dark:border-white/10 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5">Open Skills</Link>
          </div>

          {filteredQuickItems.length === 0 ? (
            <p className="text-sm text-text-muted">No matching items.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredQuickItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.type}</p>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-text-muted">arrow_forward</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 rounded-xl border border-black/10 bg-surface p-2 dark:border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-text-muted hover:bg-black/5 hover:text-text-main dark:hover:bg-white/5"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
}
