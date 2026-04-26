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

function normalizeServer(item, index) {
  const id = typeof item?.id === "string" && item.id.trim() ? item.id.trim() : `server-${index + 1}`;
  return {
    id,
    name: typeof item?.name === "string" && item.name.trim() ? item.name.trim() : id,
    source: typeof item?.source === "string" ? item.source.trim() : "",
    endpoint: typeof item?.endpoint === "string" ? item.endpoint.trim() : "",
    apiKey: typeof item?.apiKey === "string" ? item.apiKey : "",
    enabled: item?.enabled === true,
  };
}

export default function MCPServersPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [editModal, setEditModal] = useState({ open: false, server: null, index: -1 });

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
  };

  const closeEditModal = () => {
    setEditModal({ open: false, server: null, index: -1 });
  };

  const saveEditModal = async () => {
    const updated = [...servers];
    if (editModal.index >= 0) {
      updated[editModal.index] = normalizeServer(editModal.server, editModal.index);
    } else {
      updated.push(normalizeServer(editModal.server, updated.length));
    }
    await saveServers(updated);
    closeEditModal();
  };

  const addServer = () => {
    setEditModal({
      open: true,
      server: { id: "", name: "", source: "", endpoint: "", apiKey: "", enabled: false },
      index: -1,
    });
  };

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-main">Servers</h2>
            <Button variant="ghost" size="sm" icon="add" onClick={addServer} disabled={saving}>
              Add server
            </Button>
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
                    <span className="text-sm font-medium text-text-main flex-1">{server.name}</span>
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

      {editModal.open && (
        <Modal isOpen={editModal.open} onClose={closeEditModal} title={editModal.index >= 0 ? "Edit Server" : "Add Server"}>
          <div className="flex flex-col gap-4">
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
              label="Endpoint"
              value={editModal.server.endpoint}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, endpoint: e.target.value } }))}
              placeholder="https://context7.com"
            />
            <Input
              label="API Key"
              type="password"
              value={editModal.server.apiKey}
              onChange={(e) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, apiKey: e.target.value } }))}
              placeholder="Optional"
            />
            <Toggle
              label="Enabled"
              checked={editModal.server.enabled}
              onChange={(checked) => setEditModal((prev) => ({ ...prev, server: { ...prev.server, enabled: checked } }))}
            />
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
