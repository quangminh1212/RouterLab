"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";
import { CardSkeleton } from "@/shared/components/Loading";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
};

const PAGE_CONFIG = {
  mcpServers: {
    title: "MCP Servers",
    description: "JSON config for MCP sources.",
  },
  plugins: {
    title: "AI Plugins",
    description: "JSON config for plugin sources.",
  },
};

function cloneAiIntegrations(value) {
  const source = value && typeof value === "object" ? value : EMPTY_AI_INTEGRATIONS;
  return {
    enabled: source.enabled === true,
    autoConnect: source.autoConnect === true,
    mcpServers: Array.isArray(source.mcpServers) ? source.mcpServers.map((item) => ({ ...item })) : [],
    plugins: Array.isArray(source.plugins) ? source.plugins.map((item) => ({ ...item })) : [],
  };
}

function normalizeSources(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const id = typeof item?.id === "string" && item.id.trim() ? item.id.trim() : `source-${index + 1}`;
    return {
      id,
      name: typeof item?.name === "string" && item.name.trim() ? item.name.trim() : id,
      source: typeof item?.source === "string" ? item.source.trim() : "",
      endpoint: typeof item?.endpoint === "string" ? item.endpoint.trim() : "",
      apiKey: typeof item?.apiKey === "string" ? item.apiKey : "",
      enabled: item?.enabled === true,
    };
  });
}

function toJson(value) {
  return JSON.stringify(value, null, 2);
}

export default function AiSourcesPageClient({ group }) {
  const config = PAGE_CONFIG[group];
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [jsonText, setJsonText] = useState("[]");
  const [jsonError, setJsonError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = cloneAiIntegrations(data?.aiIntegrations);
        setAiForm(next);
        setJsonText(toJson(normalizeSources(next[group])));
      })
      .catch(() => setStatus({ type: "error", message: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, [group]);

  const parseJsonSources = () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("Invalid JSON format");
    }
    if (!Array.isArray(parsed)) {
      throw new Error("JSON must be an array");
    }
    return normalizeSources(parsed);
  };

  const saveSources = async () => {
    setSaving(true);
    setStatus({ type: "", message: "" });
    setJsonError("");
    try {
      const normalized = parseJsonSources();
      const nextForm = { ...aiForm, [group]: normalized };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      setAiForm(nextForm);
      setJsonText(toJson(normalized));
      setStatus({ type: "success", message: `Saved ${normalized.length} items` });
    } catch (err) {
      setJsonError(err.message || "Invalid JSON");
      setStatus({ type: "error", message: "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const testEnabled = async () => {
    setTesting(true);
    setStatus({ type: "", message: "" });
    setJsonError("");
    setTestResults([]);

    try {
      const normalized = parseJsonSources();
      const activeSources = normalized.filter((item) => item.enabled && item.endpoint);
      if (activeSources.length === 0) {
        setStatus({ type: "error", message: "No enabled sources with endpoint" });
        return;
      }

      const results = await Promise.all(activeSources.map(async (source) => {
        try {
          const res = await fetch("/api/settings/ai-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: source.endpoint, apiKey: source.apiKey }),
          });
          const data = await res.json().catch(() => ({}));
          return {
            id: source.id,
            name: source.name,
            ok: res.ok && data?.ok === true,
            status: data?.status || res.status,
            elapsedMs: data?.elapsedMs || null,
            error: data?.error || null,
          };
        } catch (err) {
          return {
            id: source.id,
            name: source.name,
            ok: false,
            status: null,
            elapsedMs: null,
            error: err?.message || "Connection failed",
          };
        }
      }));

      setTestResults(results);
      const successCount = results.filter((item) => item.ok).length;
      setStatus({
        type: successCount === results.length ? "success" : "error",
        message: `Tested ${results.length} source(s): ${successCount} OK`,
      });
    } catch (err) {
      setJsonError(err.message || "Invalid JSON");
      setStatus({ type: "error", message: "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{config.title}</h1>
          <p className="text-text-muted mt-1">{config.description}</p>
        </div>

        <Card>
          {loading ? (
            <CardSkeleton />
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="min-h-[320px] w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3 font-mono text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary/40"
                spellCheck={false}
              />

              {jsonError ? <p className="text-sm text-red-500">{jsonError}</p> : null}
              {status.message ? (
                <p className={`text-sm ${status.type === "error" ? "text-red-500" : "text-green-500"}`}>{status.message}</p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="secondary" loading={testing} disabled={saving} onClick={testEnabled}>
                  Test Enabled
                </Button>
                <Button variant="primary" loading={saving} disabled={testing} onClick={saveSources}>
                  Save JSON
                </Button>
              </div>

              {testResults.length > 0 ? (
                <pre className="mt-2 overflow-auto rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3 text-xs text-text-main">{toJson(testResults)}</pre>
              ) : null}
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
