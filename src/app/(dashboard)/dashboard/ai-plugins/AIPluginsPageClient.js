"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardSkeleton, Toggle, Modal, Input } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

const EMPTY_AI_INTEGRATIONS = {
  enabled: false,
  autoConnect: false,
  mcpServers: [],
  plugins: [],
  selectedPlugins: [],
};

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

function normalizePluginStore(item, index) {
  const id = typeof item?.id === "string" && item.id.trim() ? item.id.trim() : `store-${index + 1}`;
  return {
    id,
    name: typeof item?.name === "string" && item.name.trim() ? item.name.trim() : id,
    source: typeof item?.source === "string" && item.source.trim() ? item.source.trim() : "url",
    marketplace: typeof item?.marketplace === "string" ? item.marketplace.trim() : id,
    endpoint: typeof item?.endpoint === "string" ? item.endpoint.trim() : "",
    repo: typeof item?.repo === "string" ? item.repo.trim() : "",
    ref: typeof item?.ref === "string" ? item.ref.trim() : "",
    path: typeof item?.path === "string" ? item.path.trim() : "",
    apiKey: typeof item?.apiKey === "string" ? item.apiKey : "",
    enabled: item?.enabled === true,
  };
}

function getPluginKey(item) {
  const pluginId = typeof item?.pluginId === "string" ? item.pluginId : "";
  const marketplace = typeof item?.marketplace === "string" ? item.marketplace : "";
  return pluginId && marketplace ? `${pluginId}@${marketplace}` : "";
}

function normalizeSelectedPlugin(item) {
  return {
    pluginId: typeof item?.pluginId === "string" ? item.pluginId : "",
    name: typeof item?.name === "string" ? item.name : "",
    marketplace: typeof item?.marketplace === "string" ? item.marketplace : "",
    storeId: typeof item?.storeId === "string" ? item.storeId : "",
    storeName: typeof item?.storeName === "string" ? item.storeName : "",
    homepage: typeof item?.homepage === "string" ? item.homepage : "",
  };
}

function normalizePluginItem(item) {
  return {
    id: typeof item?.id === "string" ? item.id : "",
    pluginId: typeof item?.pluginId === "string" ? item.pluginId : "",
    name: typeof item?.name === "string" ? item.name : "",
    description: typeof item?.description === "string" ? item.description : "",
    category: typeof item?.category === "string" ? item.category : "",
    tags: Array.isArray(item?.tags) ? item.tags.filter((tag) => typeof tag === "string") : [],
    author: typeof item?.author === "string" ? item.author : "",
    homepage: typeof item?.homepage === "string" ? item.homepage : "",
    marketplace: typeof item?.marketplace === "string" ? item.marketplace : "",
    storeId: typeof item?.storeId === "string" ? item.storeId : "",
    storeName: typeof item?.storeName === "string" ? item.storeName : "",
    installCommand: typeof item?.installCommand === "string" ? item.installCommand : "",
    enabled: item?.enabled === true,
  };
}

const STORE_SOURCE_OPTIONS = [
  { value: "builtin", label: "Built-in" },
  { value: "url", label: "URL JSON" },
  { value: "github", label: "GitHub" },
];

export default function AIPluginsPageClient() {
  const [aiForm, setAiForm] = useState(() => cloneAiIntegrations(EMPTY_AI_INTEGRATIONS));
  const [stores, setStores] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [storeStatus, setStoreStatus] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, store: null, index: -1 });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = cloneAiIntegrations(data?.aiIntegrations);
        setAiForm(next);
        setStores((Array.isArray(next.plugins) ? next.plugins : []).map(normalizePluginStore));
      })
      .catch(() => setStatus({ type: "error", message: "Failed to load plugin stores" }))
      .finally(() => setLoading(false));
  }, []);

  const enabledStoresCount = useMemo(() => stores.filter((store) => store.enabled).length, [stores]);
  const selectedPluginsCount = useMemo(() => plugins.filter((plugin) => plugin.enabled).length, [plugins]);
  const integratedPluginsCount = useMemo(() => (Array.isArray(aiForm.selectedPlugins) ? aiForm.selectedPlugins.length : 0), [aiForm.selectedPlugins]);
  const integratedPluginKeys = useMemo(() => new Set((Array.isArray(aiForm.selectedPlugins) ? aiForm.selectedPlugins : []).map(getPluginKey).filter(Boolean)), [aiForm.selectedPlugins]);

  const persistStores = async (nextStores) => {
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const normalizedStores = nextStores.map(normalizePluginStore);
      const nextForm = { ...aiForm, plugins: normalizedStores };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save plugin stores");

      setAiForm(nextForm);
      setStores(normalizedStores);
      setStatus({ type: "success", message: `Saved ${normalizedStores.length} plugin store(s)` });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const toggleStore = async (index) => {
    const updated = [...stores];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    await persistStores(updated);
  };

  const openStoreModal = (store, index) => {
    setEditModal({ open: true, store: { ...store }, index });
  };

  const closeStoreModal = () => {
    setEditModal({ open: false, store: null, index: -1 });
  };

  const saveStoreModal = async () => {
    const updated = [...stores];
    if (editModal.index >= 0) {
      updated[editModal.index] = normalizePluginStore(editModal.store, editModal.index);
    } else {
      updated.push(normalizePluginStore(editModal.store, updated.length));
    }
    await persistStores(updated);
    closeStoreModal();
  };

  const addStore = () => {
    setEditModal({
      open: true,
      store: {
        id: "",
        name: "",
        source: "url",
        marketplace: "",
        endpoint: "",
        repo: "",
        ref: "",
        path: "",
        apiKey: "",
        enabled: true,
      },
      index: -1,
    });
  };

  const searchPlugins = async () => {
    setSearching(true);
    setStatus({ type: "", message: "" });
    setStoreStatus([]);
    try {
      const res = await fetch("/api/ai-plugins/store-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginStores: stores, query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to search plugins");

      setPlugins(
        (Array.isArray(data.results) ? data.results : [])
          .map(normalizePluginItem)
          .map((plugin) => ({ ...plugin, enabled: integratedPluginKeys.has(getPluginKey(plugin)) || plugin.enabled }))
      );
      setStoreStatus(Array.isArray(data.stores) ? data.stores : []);
      setStatus({
        type: "success",
        message: `Loaded ${(data.results || []).length} plugin(s) from ${(data.stores || []).length} store(s)`,
      });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Plugin search failed" });
    } finally {
      setSearching(false);
    }
  };

  const togglePlugin = (index) => {
    const updated = [...plugins];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setPlugins(updated);
  };

  const integratePluginsToXLab = async () => {
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const selectedPlugins = plugins.filter((plugin) => plugin.enabled).map(normalizeSelectedPlugin).filter((plugin) => getPluginKey(plugin));
      const nextForm = { ...aiForm, selectedPlugins };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiIntegrations: nextForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to integrate plugins into XLab Router");

      setAiForm(nextForm);
      setStatus({ type: "success", message: `Integrated ${selectedPlugins.length} plugin(s) into XLab Router` });
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Integration failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">AI Plugins</h1>
          <p className="text-text-muted mt-1">Plugin store manager: discover marketplaces and integrate selected plugins into XLab Router.</p>
          <p className="text-xs text-text-muted mt-2">
            <strong>Note:</strong> Plugins are stored locally in XLab Router settings and no CLI config is written.
          </p>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-main">XLab Plugin Integration</h2>
              <p className="text-sm text-text-muted mt-1">
                Keep selected plugins in XLab Router settings for local AI integration. Currently integrated: {integratedPluginsCount}.
              </p>
            </div>
            <Button variant="primary" size="sm" loading={saving} disabled={loading || saving || selectedPluginsCount === 0} onClick={integratePluginsToXLab}>
              Add to XLab
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-main">Plugin Stores</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Enabled: {enabledStoresCount}</span>
              <Button variant="ghost" size="sm" icon="add" onClick={addStore} disabled={saving}>
                Add Store
              </Button>
            </div>
          </div>

          {loading ? (
            <CardSkeleton />
          ) : stores.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No plugin stores configured</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stores.map((store, index) => (
                <Card key={`${store.id}-${index}`} className="!p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-main truncate">{store.name}</p>
                      <p className="text-xs text-text-muted mt-1 truncate">
                        {store.source === "github" || store.source === "builtin"
                          ? `${store.source}:${store.repo || store.marketplace}${store.ref ? `@${store.ref}` : ""}${store.path ? `/${store.path}` : ""}`
                          : store.endpoint || store.marketplace}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openStoreModal(store, index)}
                        disabled={saving}
                        className={cn("text-text-muted hover:text-text-main transition-colors", saving && "opacity-50 cursor-not-allowed")}
                        aria-label="Store settings"
                      >
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                      </button>
                      <Toggle checked={store.enabled} onChange={() => toggleStore(index)} disabled={saving} size="md" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="flex-1 min-w-[220px]"
                label="Search plugins"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="auth, github, database, observability..."
              />
              <Button variant="secondary" loading={searching} disabled={loading || saving} onClick={searchPlugins}>
                Search Stores
              </Button>
            </div>

            {storeStatus.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {storeStatus.map((item) => (
                  <div key={item.id} className={cn("rounded-lg border p-3 text-xs", item.ok ? "border-green-500/30" : "border-red-500/40")}>
                    <p className="font-medium text-text-main">{item.name}</p>
                    <p className="mt-1 text-text-muted">Marketplace: {item.marketplace || "n/a"}</p>
                    <p className={cn("mt-1", item.ok ? "text-green-500" : "text-red-500")}>{item.ok ? `OK (${item.count})` : item.error || "Failed"}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {plugins.length === 0 ? (
              <p className="text-sm text-text-muted">No plugins loaded yet. Search from enabled stores first.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[420px] overflow-auto pr-1">
                {plugins.map((plugin, index) => (
                  <Card key={`${plugin.id}-${index}`} className="!p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-main truncate">{plugin.name || plugin.pluginId}</p>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">{plugin.description || "No description"}</p>
                        <p className="text-[11px] text-text-muted mt-1">
                          {plugin.marketplace ? `${plugin.pluginId}@${plugin.marketplace}` : plugin.pluginId} • {plugin.storeName || plugin.storeId}
                        </p>
                      </div>
                      <Toggle checked={plugin.enabled} onChange={() => togglePlugin(index)} size="md" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>

        {status.message ? <p className={cn("text-sm", status.type === "error" ? "text-red-500" : "text-green-500")}>{status.message}</p> : null}

      </div>

      {editModal.open && (
        <Modal isOpen={editModal.open} onClose={closeStoreModal} title={editModal.index >= 0 ? "Edit Store" : "Add Store"}>
          <div className="flex flex-col gap-4">
            <Input
              label="ID"
              value={editModal.server?.id || editModal.store?.id || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, id: e.target.value } }))}
              placeholder="official-store"
              required
            />
            <Input
              label="Name"
              value={editModal.store?.name || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, name: e.target.value } }))}
              placeholder="Official Store"
              required
            />
            <Input
              label="Marketplace"
              value={editModal.store?.marketplace || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, marketplace: e.target.value } }))}
              placeholder="official"
            />

            <div>
              <label className="text-sm font-medium text-text-main">Source</label>
              <div className="mt-2 flex gap-2">
                {STORE_SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs",
                      (editModal.store?.source || "url") === option.value ? "border-primary text-text-main" : "border-black/10 dark:border-white/10 text-text-muted"
                    )}
                    onClick={() => setEditModal((prev) => ({ ...prev, store: { ...prev.store, source: option.value } }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {(editModal.store?.source || "url") === "github" ? (
              <>
                <Input
                  label="Repository"
                  value={editModal.store?.repo || ""}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, repo: e.target.value } }))}
                  placeholder="owner/repo"
                />
                <Input
                  label="Ref"
                  value={editModal.store?.ref || ""}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, ref: e.target.value } }))}
                  placeholder="main"
                />
                <Input
                  label="Path"
                  value={editModal.store?.path || ""}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, path: e.target.value } }))}
                  placeholder="plugins/marketplace.json"
                />
              </>
            ) : (
              <Input
                label="Endpoint"
                value={editModal.store?.endpoint || ""}
                onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, endpoint: e.target.value } }))}
                placeholder="https://plugins.example.com/marketplace.json"
              />
            )}

            <Input
              label="API Key"
              type="password"
              value={editModal.store?.apiKey || ""}
              onChange={(e) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, apiKey: e.target.value } }))}
              placeholder="Optional"
            />

            <Toggle
              label="Enabled"
              checked={Boolean(editModal.store?.enabled)}
              onChange={(checked) => setEditModal((prev) => ({ ...prev, store: { ...prev.store, enabled: checked } }))}
            />

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={closeStoreModal} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveStoreModal} loading={saving} fullWidth>
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
