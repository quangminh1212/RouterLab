"use client";

import { useState } from "react";
import MCPServersPageClient from "../mcp-servers/MCPServersPageClient";
import AIPluginsPageClient from "../ai-plugins/AIPluginsPageClient";
import AISkillsPageClient from "../ai-skills/AISkillsPageClient";
import { cn } from "@/shared/utils/cn";

const TABS = [
  { id: "mcp", label: "MCP Servers", icon: "hub", component: MCPServersPageClient },
  { id: "plugins", label: "AI Plugins", icon: "extension", component: AIPluginsPageClient },
  { id: "skills", label: "AI Skills", icon: "psychology", component: AISkillsPageClient },
];

export default function PowerUpPageClient() {
  const [activeTab, setActiveTab] = useState("mcp");
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.component || MCPServersPageClient;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-main">Power Up</h1>
        <p className="text-text-muted mt-1">Manage MCP servers, plugins, and skills locally inside XLab Router.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-black/10 bg-surface p-2 dark:border-white/10">
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
