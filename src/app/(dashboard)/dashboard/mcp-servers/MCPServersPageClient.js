"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardSkeleton, Toggle, Modal, Input } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
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

function toStringArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  if (typeof value === "string" && value.trim()) return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return asPlainObject(parsed);
  } catch {
    return {};
  }
}

function stringifyJsonObject(value) {
  const object = asPlainObject(value);
  return Object.keys(object).length > 0 ? JSON.stringify(object, null, 2) : "";
}

function normalizeServer(item, index) {
  const id = typeof item?.id === "string" && item.id.trim() ? item.id.trim() : `server-${index + 1}`;
  return {
    id,
    name: typeof item?.name === "string" && item.name.trim() ? item.name.trim() : id,
    source: typeof item?.source === "string" ? item.source.trim() : "",
    sourceUrl: typeof item?.sourceUrl === "string" ? item.sourceUrl.trim() : "",
    npmPackage: typeof item?.npmPackage === "string" ? item.npmPackage.trim() : "",
    endpoint: typeof item?.endpoint === "string" ? item.endpoint.trim() : "",
    apiKey: typeof item?.apiKey === "string" ? item.apiKey : "",
    command: typeof item?.command === "string" ? item.command.trim() : "",
    args: toStringArray(item?.args),
    env: parseJsonObject(item?.env),
    headers: parseJsonObject(item?.headers),
    enabledTools: toStringArray(item?.enabledTools),
    disabledTools: toStringArray(item?.disabledTools),
    envVars: toStringArray(item?.envVars),
    cwd: typeof item?.cwd === "string" ? item.cwd.trim() : "",
    bearerTokenEnvVar: typeof item?.bearerTokenEnvVar === "string" ? item.bearerTokenEnvVar.trim() : "",
    required: item?.required === true,
    startupTimeoutSec: Number.isFinite(Number(item?.startupTimeoutSec)) ? Number(item.startupTimeoutSec) : 20,
    toolTimeoutSec: Number.isFinite(Number(item?.toolTimeoutSec)) ? Number(item.toolTimeoutSec) : 120,
    enabled: item?.enabled === true,
  };
}

function inferNpmPackage(server) {
  if (server?.npmPackage) return server.npmPackage;
  const packageArg = (server?.args || []).find((item) => typeof item === "string" && item.includes("@latest"));
  return packageArg ? packageArg.replace(/@latest$/, "") : "";
}

function getNpmUrl(server) {
  const packageName = inferNpmPackage(server);
  return packageName ? `https://www.npmjs.com/package/${packageName}` : "https://www.npmjs.com/search?q=mcp%20server";
}

function getSourceUrl(server) {
  if (server?.sourceUrl) return server.sourceUrl;
  if (server?.endpoint?.startsWith("http")) return server.endpoint;
  return "https://github.com/modelcontextprotocol/servers";
}

const CLI_TARGETS = [
  {
    id: "codex",
    label: "Codex",
    description: "Codex CLI and IDE share ~/.codex/config.toml (OpenAI MCP format).",
    setup: "codex mcp add <name> -- <command> <args...>",
  },
  {
    id: "claude",
    label: "Claude Code",
    description: "Claude Code uses project .mcp.json (or claude mcp add commands).",
    setup: "claude mcp add <name> -- <command> <args...>",
  },
];

export default function MCPServersPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingTarget, setSyncingTarget] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [editModal, setEditModal] = useState({ open: false, server: null, index: -1 });
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = cloneAiIntegrations(data?.aiIntegrations);
        setAiForm(next);
        setServers(next.mcpServers.map(normalizeServer));
      })
      .catch(() => setStatus({ type: "error", message: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, []);

  const saveServers = async (newServers) => {
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const nextForm = { ...aiForm, mcpServers: newServers };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      setAiForm(nextForm);
      setServers(newServers);
      setStatus({ type: "success", message: "Saved successfully" });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const toggleServer = async (index) => {
    const updated = [...servers];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    await saveServers(updated);
  };

  const openEditModal = (server, index) => {
    setEditModal({ open: true, server: { ...server }, index });
    setJsonMode(false);
    setJsonText(JSON.stringify(server, null, 2));
    setJsonError("");
  };

  const closeEditModal = () => {
    setEditModal({ open: false, server: null, index: -1 });
    setJsonMode(false);
    setJsonText("");
    setJsonError("");
  };

  const saveEditModal = async () => {
    setJsonError("");
    let serverToSave = editModal.server;

    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setJsonError("JSON must be an object");
          return;
        }
        serverToSave = parsed;
      } catch (err) {
        setJsonError(err.message || "Invalid JSON");
        return;
      }
    }

    const updated = [...servers];
    if (editModal.index >= 0) {
      updated[editModal.index] = normalizeServer(serverToSave, editModal.index);
    } else {
      updated.push(normalizeServer(serverToSave, updated.length));
    }
    await saveServers(updated);
    closeEditModal();
  };

  const addServer = () => {
    const emptyServer = {
      id: "",
      name: "",
      source: "",
      endpoint: "",
      apiKey: "",
      command: "",
      args: [],
      env: {},
      headers: {},
      enabledTools: [],
      disabledTools: [],
      envVars: [],
      cwd: "",
      bearerTokenEnvVar: "",
      required: false,
      enabled: false,
    };
    setEditModal({ open: true, server: emptyServer, index: -1 });
    setJsonMode(false);
    setJsonText(JSON.stringify(emptyServer, null, 2));
    setJsonError("");
  };

  const syncToCli = async (target) => {
    setSyncingTarget(target);
    setStatus({ type: "", message: "" });
    try {
      const activeServers = servers.filter((server) => server.enabled);
      if (activeServers.length === 0) {
        setStatus({ type: "error", message: "No enabled MCP servers to sync" });
        return;
      }

      const res = await fetch("/api/cli-tools/mcp-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, mcpServers: activeServers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to sync MCP servers");

      const targets = Object.keys(data?.result || {}).join(", ") || target;
      const paths = Object.values(data?.result || {}).map((item) => item.path).filter(Boolean).join(" | ");
      setStatus({
        type: "success",
        message: `Synced ${activeServers.length} MCP server(s) to ${targets}${paths ? `: ${paths}` : ""}`,
      });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Sync failed" });
    } finally {
      setSyncingTarget("");
    }
  };

  const activeServerCount = servers.filter((server) => server.enabled).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">MCP servers</h1>
          <p className="text-text-muted mt-1">
            Connect external tools and data sources.{" "}
            <a href="#" className="text-primary hover:underline">
              Learn more.
            </a>
          </p>
        </div>

        <div>
          <Card className="mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-main">CLI integration</h2>
                <p className="text-sm text-text-muted mt-1">
                  Sync {activeServerCount} enabled MCP server(s) into the selected CLI config only.
                </p>
                <div className="grid gap-2 mt-3 text-xs text-text-muted md:grid-cols-2">
                  {CLI_TARGETS.map((target) => (
                    <div key={target.id} className="rounded-lg border border-border-subtle bg-bg-main/30 p-3">
                      <p className="font-medium text-text-main">{target.label.replace("Sync ", "")}</p>
                      <p className="mt-1">{target.description}</p>
                      <code className="mt-2 block rounded bg-bg-main px-2 py-1 text-[11px] text-text-main">{target.setup}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={syncingTarget !== ""}
                  disabled={loading || saving || Boolean(syncingTarget)}
                  onClick={() => setSyncModalOpen(true)}
                >
                  Sync
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-text-main">Servers</h2>
            <div className="flex items-center gap-2">
              <a
                href="https://www.npmjs.com/search?q=mcp%20server"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-black/10 dark:border-white/10 px-2 py-1 text-xs text-text-muted hover:text-text-main hover:border-primary/50"
              >
                <span className="material-symbols-outlined text-[16px]">storefront</span>
                NPM MCP Market
              </a>
              <a
                href="https://github.com/modelcontextprotocol/servers"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-black/10 dark:border-white/10 px-2 py-1 text-xs text-text-muted hover:text-text-main hover:border-primary/50"
              >
                <span className="material-symbols-outlined text-[16px]">hub</span>
                Official MCP Sources
              </a>
              <Button variant="ghost" size="sm" icon="add" onClick={addServer} disabled={saving}>
                Add server
              </Button>
            </div>
          </div>

          {loading ? (
            <CardSkeleton />
          ) : servers.length === 0 ? (
            <Card>
              <p className="text-sm text-text-muted text-center py-8">No servers configured</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {servers.map((server, index) => (
                <Card key={`${server.id}-${index}`} className="!p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text-main">{server.name}</span>
                      <p className="text-xs text-text-muted mt-1">
                        {server.command ? `${server.command} ${server.args.join(" ")}` : server.endpoint || server.source || server.id}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={getNpmUrl(server)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-black/10 dark:border-white/10 px-2 py-0.5 text-[11px] text-text-muted hover:text-text-main hover:border-primary/50"
                        >
                          npm
                        </a>
                        <a
                          href={getSourceUrl(server)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-black/10 dark:border-white/10 px-2 py-0.5 text-[11px] text-text-muted hover:text-text-main hover:border-primary/50"
                        >
                          source
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(server, index)}
                        disabled={saving}
                        className={cn(
                          "text-text-muted hover:text-text-main transition-colors",
                          saving && "opacity-50 cursor-not-allowed"
                        )}
                        aria-label="Settings"
                      >
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                      </button>
                      <Toggle checked={server.enabled} onChange={() => toggleServer(index)} disabled={saving} size="md" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {status.message ? (
            <p className={cn("text-sm mt-3", status.type === "error" ? "text-red-500" : "text-green-500")}>
              {status.message}
            </p>
          ) : null}
        </div>
      </div>

      {syncModalOpen && (
        <Modal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} title="Sync MCP to CLI">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">Choose target CLI to sync enabled MCP servers.</p>
            {CLI_TARGETS.map((target) => (
              <button
                key={target.id}
                type="button"
                className="w-full rounded-lg border border-black/10 dark:border-white/10 p-3 text-left hover:border-primary/60 transition-colors"
                onClick={async () => {
                  setSyncModalOpen(false);
                  await syncToCli(target.id);
                }}
                disabled={Boolean(syncingTarget)}
              >
                <p className="text-sm font-medium text-text-main">{target.label}</p>
                <p className="text-xs text-text-muted mt-1">{target.description}</p>
              </button>
            ))}
            <button
              type="button"
              className="w-full rounded-lg border border-primary/40 bg-primary/10 p-3 text-left hover:bg-primary/20 transition-colors"
              onClick={async () => {
                setSyncModalOpen(false);
                await syncToCli("all");
              }}
              disabled={Boolean(syncingTarget)}
            >
              <p className="text-sm font-medium text-text-main">All CLI</p>
              <p className="text-xs text-text-muted mt-1">Sync to both Codex and Claude Code.</p>
            </button>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSyncModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editModal.open && (
        <Modal isOpen={editModal.open} onClose={closeEditModal} title={editModal.index >= 0 ? "Edit Server" : "Add Server"}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
              <span className="text-sm text-text-muted">Edit mode</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn("px-3 py-1.5 text-xs rounded transition-colors", !jsonMode ? "bg-primary text-white" : "bg-surface text-text-muted hover:text-text-main")}
                  onClick={() => { setJsonMode(false); setJsonError(""); }}
                >
                  Form
                </button>
                <button
                  type="button"
                  className={cn("px-3 py-1.5 text-xs rounded transition-colors", jsonMode ? "bg-primary text-white" : "bg-surface text-text-muted hover:text-text-main")}
                  onClick={() => { setJsonMode(true); setJsonText(JSON.stringify(editModal.server, null, 2)); setJsonError(""); }}
                >
                  JSON
                </button>
              </div>
            </div>

            {jsonMode ? (
              <>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="min-h-[420px] w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3 font-mono text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary/40"
                  spellCheck={false}
                  placeholder='{"id": "my-server", "name": "My Server", ...}'
                />
                {jsonError && <p className="text-sm text-red-500">{jsonError}</p>}
              </>
            ) : (
              <>
            <Input
              label="ID"
              value={editModal.server.id}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, id: e.target.value } }))}
              placeholder="context7"
              required
            />
            <Input
              label="Name"
              value={editModal.server.name}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, name: e.target.value } }))}
              placeholder="Context7 Docs"
              required
            />
            <Input
              label="Source"
              value={editModal.server.source}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, source: e.target.value } }))}
              placeholder="documentation"
            />
            <Input
              label="NPM package"
              value={editModal.server.npmPackage || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, npmPackage: e.target.value } }))}
              placeholder="@modelcontextprotocol/server-filesystem"
            />
            <Input
              label="Source URL"
              value={editModal.server.sourceUrl || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, sourceUrl: e.target.value } }))}
              placeholder="https://github.com/modelcontextprotocol/servers"
            />
            <Input
              label="Endpoint"
              value={editModal.server.endpoint}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, endpoint: e.target.value } }))}
              placeholder="https://mcp.example.com/mcp"
            />
            <Input
              label="Command"
              value={editModal.server.command}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, command: e.target.value } }))}
              placeholder="npx / python / docker"
            />
            <Input
              label="Args"
              value={(editModal.server.args || []).join(", ")}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, args: toStringArray(e.target.value) } }))}
              placeholder={'-y, @upstash/context7-mcp@latest'}
            />
            <Input
              label="Env JSON"
              value={stringifyJsonObject(editModal.server.env)}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, env: parseJsonObject(e.target.value) } }))}
              placeholder={'{ "API_KEY": "${API_KEY}" }'}
            />
            <Input
              label="Headers JSON"
              value={stringifyJsonObject(editModal.server.headers)}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, headers: parseJsonObject(e.target.value) } }))}
              placeholder={'{ "X-API-Key": "${API_KEY}" }'}
            />
            <Input
              label="Bearer Token Env (Codex HTTP)"
              value={editModal.server.bearerTokenEnvVar || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, bearerTokenEnvVar: e.target.value } }))}
              placeholder="OPENAI_API_KEY"
            />
            <Input
              label="env_vars allow list (Codex)"
              value={(editModal.server.envVars || []).join(", ")}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, envVars: toStringArray(e.target.value) } }))}
              placeholder="OPENAI_API_KEY, GITHUB_TOKEN"
            />
            <Input
              label="Enabled tools"
              value={(editModal.server.enabledTools || []).join(", ")}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, enabledTools: toStringArray(e.target.value) } }))}
              placeholder="search, fetch"
            />
            <Input
              label="Disabled tools"
              value={(editModal.server.disabledTools || []).join(", ")}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, disabledTools: toStringArray(e.target.value) } }))}
              placeholder="delete_all"
            />
            <Input
              label="Working directory"
              value={editModal.server.cwd || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, cwd: e.target.value } }))}
              placeholder="C:/Dev/Work/2000/Dev"
            />
            <Input
              label="API Key"
              type="password"
              value={editModal.server.apiKey}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, apiKey: e.target.value } }))}
              placeholder="Optional bearer token for HTTP MCP"
            />
            <Toggle
              label="Required (Codex startup fail if unavailable)"
              checked={Boolean(editModal.server.required)}
              onChange={(checked) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, required: checked } }))}
            />
            <Toggle
              label="Enabled"
              checked={editModal.server.enabled}
              onChange={(checked) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, enabled: checked } }))}
            />
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={closeEditModal} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEditModal} loading={saving} fullWidth>
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
