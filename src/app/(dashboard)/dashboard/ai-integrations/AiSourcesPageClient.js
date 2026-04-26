"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Card, CardSkeleton, Input, Toggle } from "@/shared/components";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
};

const PAGE_CONFIG = {
  mcpServers: {
    title: "MCP Servers",
    description: "Connect MCP sources for documentation, web search, and agent memory.",
    icon: "hub",
    color: "bg-blue-500/10 text-blue-500",
    empty: "No MCP servers configured",
    getIcon: (source) => (source === "documentation" ? "description" : source === "web-search" ? "search" : "memory"),
  },
  plugins: {
    title: "AI Plugins",
    description: "Connect AI plugin sources used by agent workflows.",
    icon: "extension",
    color: "bg-violet-500/10 text-violet-500",
    empty: "No plugins configured",
    getIcon: () => "extension",
  },
};

function cloneAiIntegrations(value) {
  const source = value && typeof value === "object" ? value : EMPTY_AI_INTEGRATIONS;
  return {
    enabled: source.enabled === true,
    autoConnect: source.autoConnect === true,
    mcpServers: Array.isArray(source.mcpServers)
      ? source.mcpServers.map((item) => ({ ...item }))
      : [],
    plugins: Array.isArray(source.plugins)
      ? source.plugins.map((item) => ({ ...item }))
      : [],
  };
}

export default function AiSourcesPageClient({ group }) {
  const config = PAGE_CONFIG[group];
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setAiForm(cloneAiIntegrations(data?.aiIntegrations)))
      .catch(() => setStatus({ type: "error", message: "Failed to load AI integrations" }))
      .finally(() => setLoading(false));
  }, []);

  const updateSource = (id, patch) => {
    setAiForm((prev) => ({
      ...prev,
      [group]: (prev[group] || []).map((source) => (
        source.id === id ? { ...source, ...patch } : source
      )),
    }));
  };

  const saveSources = async () => {
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: aiForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save AI integrations");
      setStatus({ type: "success", message: `${config.title} saved` });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to save AI integrations" });
    } finally {
      setSaving(false);
    }
  };

  const testSource = async (source) => {
    setTestingId(source.id);
    setStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: source.endpoint, apiKey: source.apiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data.error || `Connection failed${data.status ? ` (${data.status})` : ""}`);
      }
      setStatus({ type: "success", message: `${source.name} connected in ${data.elapsedMs}ms` });
    } catch (err) {
      setStatus({ type: "error", message: `${source.name}: ${err.message || "Connection failed"}` });
    } finally {
      setTestingId("");
    }
  };

  const sources = aiForm[group] || [];
  const disabled = loading || saving;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{config.title}</h1>
          <p className="text-text-muted mt-1">{config.description}</p>
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <span className="material-symbols-outlined text-[20px]">{config.icon}</span>
            </div>
            <h3 className="text-lg font-semibold">Sources</h3>
          </div>

          {loading ? (
            <div className="grid gap-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {sources.length === 0 ? (
                <p className="text-sm text-text-muted">{config.empty}</p>
              ) : (
                sources.map((source) => (
                  <div key={source.id} className="flex flex-col gap-3 p-4 rounded-lg bg-bg border border-border">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-text-muted">
                          {config.getIcon(source.source)}
                        </span>
                        <div>
                          <p className="font-medium">{source.name}</p>
                          <p className="text-xs text-text-muted uppercase tracking-wide">{source.source}</p>
                        </div>
                      </div>
                      <Toggle
                        checked={source.enabled}
                        onChange={() => updateSource(source.id, { enabled: !source.enabled })}
                        disabled={disabled}
                      />
                    </div>
                    <Input
                      label="Endpoint URL"
                      placeholder="https://example.com"
                      value={source.endpoint}
                      onChange={(e) => updateSource(source.id, { endpoint: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label="API Key"
                      placeholder="Optional"
                      type="password"
                      value={source.apiKey}
                      onChange={(e) => updateSource(source.id, { apiKey: e.target.value })}
                      disabled={disabled}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={testingId === source.id}
                        disabled={disabled || !source.endpoint}
                        onClick={() => testSource(source)}
                      >
                        Test Connection
                      </Button>
                    </div>
                  </div>
                ))
              )}

              <div className="pt-4 border-t border-border flex items-center gap-2">
                <Button variant="primary" loading={saving} disabled={disabled} onClick={saveSources}>
                  Save {config.title}
                </Button>
              </div>

              {status.message && (
                <p className={`text-sm ${status.type === "error" ? "text-red-500" : "text-green-500"}`}>
                  {status.message}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

AiSourcesPageClient.propTypes = {
  group: PropTypes.oneOf(["mcpServers", "plugins"]).isRequired,
};
