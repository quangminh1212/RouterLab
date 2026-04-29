"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, Button, Input, Modal, CardSkeleton, Toggle, ModelSelectModal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { logger } from "@/lib/logger";

const TUNNEL_BENEFITS = [
  { icon: "public", title: "Access Anywhere", desc: "Use your API from any network" },
  { icon: "group", title: "Share Endpoint", desc: "Share URL with team members" },
  { icon: "code", title: "Use in Cursor/Cline", desc: "Connect AI tools remotely" },
  { icon: "lock", title: "Encrypted", desc: "End-to-end TLS via Cloudflare" },
];

const TUNNEL_PING_INTERVAL_MS = 2000;
const TUNNEL_PING_MAX_MS = 300000;

function createDashboardTraceId(prefix) {
  return logger.dashboardPerf.traceId(prefix);
}

function logDashboardPerf(level, message, meta = {}, options = {}) {
  logger.dashboardPerf[level]("DASHBOARD_CLIENT", message, meta, options);
}

export default function APIPageClient() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyHasLimit, setNewKeyHasLimit] = useState(false);
  const [newKeyCostLimit, setNewKeyCostLimit] = useState("");
  const [createKeyError, setCreateKeyError] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editKeyError, setEditKeyError] = useState("");
  const [editAllowedModels, setEditAllowedModels] = useState("");
  const [editRpmLimit, setEditRpmLimit] = useState("");
  const [editHasCostLimit, setEditHasCostLimit] = useState(false);
  const [editCostLimit, setEditCostLimit] = useState("");
  const [modelAliases, setModelAliases] = useState({});
  const [activeProviders, setActiveProviders] = useState([]);
  const [showAllowedModelsModal, setShowAllowedModelsModal] = useState(false);

  const [requireApiKey, setRequireApiKey] = useState(false);
  const [requireLogin, setRequireLogin] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);
  const [tunnelDashboardAccess, setTunnelDashboardAccess] = useState(false);
  const [rtkEnabled, setRtkEnabledState] = useState(false);

  // Cloudflare Tunnel state
  const [tunnelChecking, setTunnelChecking] = useState(true);
  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [tunnelPublicUrl, setTunnelPublicUrl] = useState("");
  const [tunnelProvider, setTunnelProvider] = useState("cloudflare");
  const [selectedTunnelProvider, setSelectedTunnelProvider] = useState("cloudflare");
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelProgress, setTunnelProgress] = useState("");
  const [tunnelStatus, setTunnelStatus] = useState(null);
  const [showEnableTunnelModal, setShowEnableTunnelModal] = useState(false);
  const [showDisableTunnelModal, setShowDisableTunnelModal] = useState(false);

  // Tailscale state
  const [tsEnabled, setTsEnabled] = useState(false);
  const [tsUrl, setTsUrl] = useState("");
  const [tsLoading, setTsLoading] = useState(false);
  const [tsProgress, setTsProgress] = useState("");
  const [tsStatus, setTsStatus] = useState(null);
  const [tsInstalled, setTsInstalled] = useState(null); // null=checking, true/false
  const [tsInstalling, setTsInstalling] = useState(false);
  const [tsInstallLog, setTsInstallLog] = useState([]);
  const [tsSudoPassword, setTsSudoPassword] = useState("");
  const [tsConnecting, setTsConnecting] = useState(false);
  const [showTsModal, setShowTsModal] = useState(false);
  const [showDisableTsModal, setShowDisableTsModal] = useState(false);
  const tsLogRef = useRef(null);

  // API key visibility toggle state
  const [visibleKeys, setVisibleKeys] = useState(new Set());

  const { copied, copy } = useCopyToClipboard();

  // Auto-scroll install log
  useEffect(() => {
    if (tsLogRef.current) tsLogRef.current.scrollTop = tsLogRef.current.scrollHeight;
  }, [tsInstallLog]);

  function applyTunnelStatus(data = {}) {
    const tunnelData = data.tunnel || {};
    const tailscaleData = data.tailscale || {};

    setTunnelUrl(tunnelData.tunnelUrl || "");
    setTunnelPublicUrl(tunnelData.publicUrl || "");
    setTunnelEnabled(tunnelData.enabled || false);
    setTunnelProvider(tunnelData.provider || "cloudflare");
    setTsUrl(tailscaleData.tunnelUrl || "");
    setTsEnabled(tailscaleData.enabled || false);
  }

  function applySettingsState(settings = {}) {
    setRequireApiKey(settings.requireApiKey || false);
    setRequireLogin(settings.requireLogin !== false);
    setHasPassword(settings.hasPassword || false);
    setTunnelDashboardAccess(settings.tunnelDashboardAccess || false);
  }

  const fetchTunnelStatus = useCallback(async () => {
    const traceId = createDashboardTraceId("endpoint-tunnel-status");
    const start = performance.now();
    setTunnelChecking(true);

    logDashboardPerf("debug", "fetchTunnelStatus:start", { traceId }, { verbose: true });

    try {
      const responseStart = performance.now();
      const res = await fetch("/api/tunnel/status", {
        headers: { "x-debug-trace-id": traceId, "x-debug-op": "fetchTunnelStatus" },
      });
      const responseDurationMs = Math.round(performance.now() - responseStart);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load tunnel status");
      }

      const applyStart = performance.now();
      applyTunnelStatus(data);
      const applyStateDurationMs = Math.round(performance.now() - applyStart);

      logDashboardPerf("info", "fetchTunnelStatus:done", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        responseDurationMs,
        applyStateDurationMs,
      });
    } catch (error) {
      logDashboardPerf("error", "fetchTunnelStatus:error", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        error: error.message,
      }, { force: true });
      console.log("Error fetching tunnel status:", error);
    } finally {
      setTunnelChecking(false);
    }
  }, []);

  const fetchBootstrap = useCallback(async () => {
    const traceId = createDashboardTraceId("endpoint-bootstrap");
    const start = performance.now();
    setKeysLoading(true);

    logDashboardPerf("debug", "fetchBootstrap:start", { traceId }, { verbose: true });

    try {
      const responseStart = performance.now();
      const res = await fetch("/api/dashboard/bootstrap", {
        headers: { "x-debug-trace-id": traceId },
      });
      const responseDurationMs = Math.round(performance.now() - responseStart);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load dashboard bootstrap");
      }

      const applyStart = performance.now();
      setKeys(data.keys || []);
      applySettingsState(data.settings);
      const applyStateDurationMs = Math.round(performance.now() - applyStart);

      void fetchModelPickerData();

      logDashboardPerf("info", "fetchBootstrap:done", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        responseDurationMs,
        applyStateDurationMs,
        keysCount: Array.isArray(data.keys) ? data.keys.length : 0,
      });

      void fetchTunnelStatus();
    } catch (error) {
      logDashboardPerf("error", "fetchBootstrap:error", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        error: error.message,
      }, { force: true });
      console.log("Error fetching dashboard bootstrap:", error);
    } finally {
      setKeysLoading(false);
      setLoading(false);
    }
  }, [fetchTunnelStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchBootstrap();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchBootstrap]);

  async function loadSettings() {
    const traceId = createDashboardTraceId("endpoint-settings");
    const start = performance.now();
    setTunnelChecking(true);

    logDashboardPerf("debug", "loadSettings:start", { traceId }, { verbose: true });

    try {
      const settingsStart = performance.now();
      const tunnelStart = performance.now();
      const [settingsRes, statusRes] = await Promise.all([
        fetch("/api/settings", {
          headers: { "x-debug-trace-id": traceId, "x-debug-op": "loadSettings:settings" },
        }),
        fetch("/api/tunnel/status", {
          headers: { "x-debug-trace-id": traceId, "x-debug-op": "loadSettings:tunnelStatus" },
        })
      ]);
      const settingsDurationMs = Math.round(performance.now() - settingsStart);
      const tunnelStatusDurationMs = Math.round(performance.now() - tunnelStart);

      const applyStart = performance.now();
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        applySettingsState(data);
        setRtkEnabledState(data.rtkEnabled || false);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        applyTunnelStatus(data);
      }
      const applyStateDurationMs = Math.round(performance.now() - applyStart);

      logDashboardPerf("info", "loadSettings:done", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        settingsDurationMs,
        tunnelStatusDurationMs,
        applyStateDurationMs,
        settingsOk: settingsRes.ok,
        tunnelStatusOk: statusRes.ok,
      });
    } catch (error) {
      logDashboardPerf("error", "loadSettings:error", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        error: error.message,
      }, { force: true });
      console.log("Error loading settings:", error);
    } finally {
      setTunnelChecking(false);
    }
  }

  const handleTunnelDashboardAccess = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tunnelDashboardAccess: value }),
      });
      if (res.ok) setTunnelDashboardAccess(value);
    } catch (error) {
      console.log("Error updating tunnelDashboardAccess:", error);
    }
  };

  const handleRequireApiKey = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApiKey: value }),
      });
      if (res.ok) setRequireApiKey(value);
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
    }
  };

  const handleRtkEnabled = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtkEnabled: value }),
      });
      if (res.ok) setRtkEnabledState(value);
    } catch (error) {
      console.log("Error updating rtkEnabled:", error);
    }
  };

  const fetchModelPickerData = useCallback(async () => {
    try {
      const [providersRes, aliasesRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/models/alias"),
      ]);

      if (providersRes.ok) {
        const providersData = await providersRes.json();
        setActiveProviders(providersData.connections || []);
      }

      if (aliasesRes.ok) {
        const aliasesData = await aliasesRes.json();
        setModelAliases(aliasesData.aliases || {});
      }
    } catch (error) {
      console.log("Error fetching model picker data:", error);
    }
  }, []);

  const getAllowedModelsList = useCallback((value) => (
    value
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean)
  ), []);

  const getAllowedModelsSummary = useCallback((value) => {
    const models = Array.isArray(value) ? value : getAllowedModelsList(value || "");
    if (models.length === 0) return "All models";
    if (models.length <= 2) return models.join(", ");
    return `${models.slice(0, 2).join(", ")} +${models.length - 2}`;
  }, [getAllowedModelsList]);

  const handleAddAllowedModel = useCallback((model) => {
    const value = typeof model === "string" ? model : model?.value;
    if (!value) return;

    setEditAllowedModels((prev) => {
      const next = getAllowedModelsList(prev);
      if (next.includes(value)) return prev;
      return [...next, value].join(", ");
    });
  }, [getAllowedModelsList]);

  const handleRemoveAllowedModel = useCallback((modelToRemove) => {
    setEditAllowedModels((prev) => getAllowedModelsList(prev)
      .filter((model) => model !== modelToRemove)
      .join(", "));
  }, [getAllowedModelsList]);

  const allowedModelsList = getAllowedModelsList(editAllowedModels);

  const formatAllowedModels = useCallback((models) => {
    if (!Array.isArray(models) || models.length === 0) return ["All models"];
    return models;
  }, []);

  const formatLimitValue = useCallback((label, value) => ({ label, value }), []);

  const getVisibleModels = useCallback((models) => {
    if (!Array.isArray(models) || models.length === 0) return [];
    return models.slice(0, 2);
  }, []);

  const getHiddenModelsCount = useCallback((models) => {
    if (!Array.isArray(models) || models.length <= 2) return 0;
    return models.length - 2;
  }, []);

  const formatCreatedDate = useCallback((value) => new Date(value).toLocaleDateString(), []);

  const maskKey = (fullKey) => {
    if (!fullKey) return "";
    return fullKey.length > 8 ? fullKey.slice(0, 8) + "..." : fullKey;
  };

  const getDisplayKey = useCallback((key) => (visibleKeys.has(key.id) ? key.key : maskKey(key.key)), [visibleKeys]);

  const getKeyLimits = useCallback((key) => ([
    formatLimitValue(
      "Cost",
      Number.isFinite(Number(key.costLimit)) && Number(key.costLimit) > 0
        ? `$${Number(key.costLimit).toFixed(2)}`
        : "Unlimited"
    ),
    formatLimitValue(
      "RPM",
      Number.isFinite(Number(key.rpmLimit)) && Number(key.rpmLimit) > 0
        ? `${Math.floor(Number(key.rpmLimit))}`
        : "Unlimited"
    ),
  ]), [formatLimitValue]);

  const getModelsChipLabel = useCallback((key) => getAllowedModelsSummary(key.allowedModels || []), [getAllowedModelsSummary]);

  const getModelsListForCard = useCallback((key) => formatAllowedModels(key.allowedModels), [formatAllowedModels]);

  const getPausedLabel = useCallback((key) => key.isActive === false, []);

  const getEditButtonTitle = useCallback(() => "Edit limits", []);

  const getToggleTitle = useCallback((key) => (key.isActive ? "Pause key" : "Resume key"), []);

  const getDeleteButtonTitle = useCallback(() => "Delete key", []);

  const getCopyButtonTitle = useCallback((keyId) => (copied === keyId ? "Copied" : "Copy key"), [copied]);

  const getVisibilityButtonTitle = useCallback((keyId) => (visibleKeys.has(keyId) ? "Hide key" : "Show key"), [visibleKeys]);

  const getAllowedModelsInputValue = useCallback(() => allowedModelsList.join(", "), [allowedModelsList]);

  const setAllowedModelsInputValue = useCallback((value) => setEditAllowedModels(value), []);

  const fetchData = async () => {
    setKeysLoading(true);
    try {
      const keysRes = await fetch("/api/keys");
      const keysData = await keysRes.json();
      if (keysRes.ok) {
        setKeys(keysData.keys || []);
      }
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setKeysLoading(false);
    }
  };

  // u2500u2500u2500 Cloudflare Tunnel handlers
  // Ping tunnel health until reachable, also check backend status to detect process die
  const pingTunnelHealth = async (url) => {
    const traceId = createDashboardTraceId("tunnel-health");
    const start = Date.now();
    let attempts = 0;
    setTunnelLoading(true);
    setTunnelProgress("Waiting for tunnel ready...");
    const healthUrl = `${url}/api/health`;

    logDashboardPerf("debug", "pingTunnelHealth:start", { traceId, url }, { verbose: true });

    while (Date.now() - start < TUNNEL_PING_MAX_MS) {
      attempts += 1;
      await new Promise((r) => setTimeout(r, TUNNEL_PING_INTERVAL_MS));
      try {
        const ping = await fetch(healthUrl, { mode: "no-cors", cache: "no-store" });
        if (ping.ok || ping.type === "opaque") {
          const durationMs = Date.now() - start;
          setTunnelEnabled(true);
          setTunnelLoading(false);
          setTunnelProgress("");
          logDashboardPerf("info", "pingTunnelHealth:success", { traceId, durationMs, attempts, url });
          return true;
        }
      } catch { /* not ready yet */ }
      // Every 5 pings (~10s), check if backend process still alive
      if ((Date.now() - start) % 10000 < TUNNEL_PING_INTERVAL_MS) {
        logDashboardPerf("debug", "pingTunnelHealth:checkpoint", {
          traceId,
          elapsedMs: Date.now() - start,
          attempts,
        }, { verbose: true });
        try {
          const statusRes = await fetch("/api/tunnel/status", {
            headers: { "x-debug-trace-id": traceId, "x-debug-op": "pingTunnelHealth:status" },
          });
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (!status.tunnel?.enabled) {
              const durationMs = Date.now() - start;
              setTunnelStatus({ type: "error", message: "Tunnel process stopped unexpectedly." });
              setTunnelLoading(false);
              setTunnelProgress("");
              logDashboardPerf("warn", "pingTunnelHealth:stopped", { traceId, durationMs, attempts });
              return false;
            }
          }
        } catch { /* ignore */ }
      }
    }
    const durationMs = Date.now() - start;
    setTunnelStatus({ type: "error", message: "Tunnel created but not reachable. Please try again." });
    setTunnelLoading(false);
    setTunnelProgress("");
    logDashboardPerf("warn", "pingTunnelHealth:timeout", { traceId, durationMs, attempts, url });
    return false;
  };

  const handleEnableTunnel = async (provider = selectedTunnelProvider) => {
    setShowEnableTunnelModal(false);
    setTunnelLoading(true);
    setTunnelStatus(null);
    setTunnelProgress("Creating tunnel...");

    // Poll download progress while enable request is pending
    let polling = true;
    const pollProgress = async () => {
      while (polling) {
        try {
          const r = await fetch("/api/tunnel/status");
          if (r.ok) {
            const s = await r.json();
            if (s.download?.downloading) {
              setTunnelProgress(`Downloading cloudflared... ${s.download.progress}%`);
            } else if (polling) {
              setTunnelProgress("Creating tunnel...");
            }
          }
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    pollProgress();

    try {
      const res = await fetch("/api/tunnel/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      polling = false;
      const data = await res.json();
      if (!res.ok) {
        setTunnelStatus({ type: "error", message: data.error || "Failed to enable tunnel" });
        return;
      }

      const url = data.publicUrl || data.tunnelUrl;
      if (!url) {
        setTunnelStatus({ type: "error", message: "No tunnel URL returned" });
        return;
      }

      setTunnelUrl(data.tunnelUrl || "");
      setTunnelPublicUrl(data.publicUrl || "");
      setTunnelProvider(data.provider || provider);
      await pingTunnelHealth(url);
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message });
    } finally {
      polling = false;
      setTunnelLoading(false);
      setTunnelProgress("");
    }
  };

  const handleDisableTunnel = async () => {
    setTunnelLoading(true);
    setTunnelStatus(null);
    try {
      const res = await fetch("/api/tunnel/disable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTunnelEnabled(false);
        setTunnelUrl("");
        setTunnelPublicUrl("");
        setShowDisableTunnelModal(false);
        setTunnelStatus({ type: "success", message: "Tunnel disabled" });
      } else {
        setTunnelStatus({ type: "error", message: data.error || "Failed to disable tunnel" });
      }
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message });
    } finally {
      setTunnelLoading(false);
    }
  };

  // u2500u2500u2500 Tailscale handlers
  const checkTailscaleInstalled = async () => {
    setTsInstalled(null);
    try {
      const res = await fetch("/api/tunnel/tailscale-check");
      if (res.ok) {
        const data = await res.json();
        setTsInstalled(data.installed);
        return data;
      }
    } catch { /* ignore */ }
    setTsInstalled(false);
    return { installed: false };
  };

  const handleInstallTailscale = async () => {
    setTsInstalling(true);
    setTsStatus(null);
    setTsInstallLog([]);
    try {
      const res = await fetch("/api/tunnel/tailscale-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sudoPassword: tsSudoPassword }),
      });
      setTsSudoPassword("");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const lines = part.split("\n");
          let event = "progress";
          let data = null;
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            if (line.startsWith("data: ")) {
              try { data = JSON.parse(line.slice(6)); } catch { /* skip */ }
            }
          }
          if (!data) continue;
          if (event === "progress") {
            setTsInstallLog((prev) => [...prev.slice(-50), data.message]);
          } else if (event === "done") {
            setTsInstalled(true);
            setTsInstalling(false);
            return;
          } else if (event === "error") {
            setTsStatus({ type: "error", message: data.error || "Install failed" });
          }
        }
      }
    } catch (e) {
      setTsStatus({ type: "error", message: e.message });
    } finally {
      setTsInstalling(false);
    }
  };

  // Ping Tailscale health until reachable
  const pingTsHealth = async (url) => {
    setTsProgress("Waiting for Tailscale ready...");
    const healthUrl = `${url}/api/health`;
    const start = Date.now();
    while (Date.now() - start < TUNNEL_PING_MAX_MS) {
      await new Promise((r) => setTimeout(r, TUNNEL_PING_INTERVAL_MS));
      try {
        const ping = await fetch(healthUrl, { mode: "no-cors", cache: "no-store" });
        if (ping.ok || ping.type === "opaque") return true;
      } catch { /* not ready yet */ }
    }
    return false;
  };

  const handleConnectTailscale = async (preOpenedTab) => {
    const tab = preOpenedTab || null;
    setShowTsModal(false);
    setTsConnecting(true);
    setTsLoading(true);
    setTsStatus(null);
    setTsProgress("Connecting...");
    try {
      const res = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        if (tab) tab.close();
        setTsUrl(data.tunnelUrl || "");
        const reachable = await pingTsHealth(data.tunnelUrl);
        if (reachable) {
          setTsEnabled(true);
          setTsStatus(null);
        } else {
          setTsEnabled(true);
          setTsStatus({ type: "warning", message: "Connected but not reachable yet." });
        }
        return;
      }

      // Needs login: redirect pre-opened tab or open new
      if (data.needsLogin && data.authUrl) {
        if (tab) tab.location.href = data.authUrl;
        else window.open(data.authUrl, "tailscale_auth", "width=600,height=700");
        setTsProgress("Waiting for login...");
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const r2 = await fetch("/api/tunnel/tailscale-check");
            if (r2.ok) {
              const check = await r2.json();
              if (check.loggedIn) {
                setTsProgress("Starting funnel...");
                const res2 = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
                const data2 = await res2.json();
                if (res2.ok && data2.success) {
                  if (tab) tab.close();
                  setTsUrl(data2.tunnelUrl || "");
                  const ok2 = await pingTsHealth(data2.tunnelUrl);
                  if (ok2) {
                    setTsEnabled(true);
                    setTsStatus(null);
                  } else {
                    setTsEnabled(true);
                    setTsStatus({ type: "warning", message: "Connected but not reachable yet." });
                  }
                } else if (data2.funnelNotEnabled && data2.enableUrl) {
                  await pollFunnelEnable(data2.enableUrl, tab);
                } else {
                  setTsStatus({ type: "error", message: data2.error || "Failed to start funnel" });
                }
                return;
              }
            }
          } catch { /* retry */ }
        }
        setTsStatus({ type: "error", message: "Login timed out. Please try again." });
        return;
      }

      // Funnel not enabled: redirect pre-opened tab
      if (data.funnelNotEnabled && data.enableUrl) {
        await pollFunnelEnable(data.enableUrl, tab);
        return;
      }

      if (tab) tab.close();
      setTsStatus({ type: "error", message: data.error || "Failed to connect" });
    } catch (error) {
      if (tab) tab.close();
      setTsStatus({ type: "error", message: error.message });
    } finally {
      setTsLoading(false);
      setTsConnecting(false);
      setTsProgress("");
    }
  };

  const pollFunnelEnable = async (enableUrl, tab) => {
    if (tab) tab.location.href = enableUrl;
    else window.open(enableUrl, "tailscale_auth", "width=600,height=700");
    setTsProgress("Enable Funnel in browser, waiting...");
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.success) {
          if (tab) tab.close();
          setTsUrl(data.tunnelUrl || "");
          const ok3 = await pingTsHealth(data.tunnelUrl);
          if (ok3) {
            setTsEnabled(true);
            setTsStatus(null);
          } else {
            setTsEnabled(true);
            setTsStatus({ type: "warning", message: "Connected but not reachable yet." });
          }
          return;
        }
        if (data.funnelNotEnabled) continue;
        if (data.error) {
          setTsStatus({ type: "error", message: data.error });
          return;
        }
      } catch { /* retry */ }
    }
    setTsStatus({ type: "error", message: "Timed out waiting for Funnel to be enabled." });
  };

  const handleDisableTailscale = async () => {
    setTsLoading(true);
    setTsStatus(null);
    try {
      const res = await fetch("/api/tunnel/tailscale-disable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTsEnabled(false);
        setTsUrl("");
        setShowDisableTsModal(false);
        setTsStatus({ type: "success", message: "Tailscale disabled" });
      } else {
        setTsStatus({ type: "error", message: data.error || "Failed to disable Tailscale" });
      }
    } catch (e) {
      setTsStatus({ type: "error", message: e.message });
    } finally {
      setTsLoading(false);
    }
  };

  const handleOpenTsModal = async () => {
    setTsStatus(null);
    setTsInstallLog([]);
    setShowTsModal(true);
    await checkTailscaleInstalled();
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    setCreateKeyError("");

    if (newKeyHasLimit) {
      const normalizedLimit = Number(newKeyCostLimit);
      if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
        setCreateKeyError("Cost limit must be a positive number");
        return;
      }
    }

    try {
      const payload = {
        name: newKeyName,
        hasCostLimit: newKeyHasLimit,
        costLimit: newKeyHasLimit ? Number(newKeyCostLimit) : null,
      };

      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setCreatedKey(data.key);
        await fetchData();
        setNewKeyName("");
        setNewKeyHasLimit(false);
        setNewKeyCostLimit("");
        setCreateKeyError("");
        setShowAddModal(false);
      } else {
        setCreateKeyError(data.error || "Failed to create key");
      }
    } catch (error) {
      console.log("Error creating key:", error);
      setCreateKeyError("Failed to create key");
    }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm("Delete this API key?")) return;

    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== id));
        // Clean up visibility state
        setVisibleKeys(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch (error) {
      console.log("Error deleting key:", error);
    }
  };

  const openEditKeyModal = (key) => {
    const hasCostLimit = Number.isFinite(Number(key.costLimit)) && Number(key.costLimit) > 0;
    setEditingKey(key);
    setEditAllowedModels(Array.isArray(key.allowedModels) ? key.allowedModels.join(", ") : "");
    setEditRpmLimit(Number.isFinite(Number(key.rpmLimit)) && Number(key.rpmLimit) > 0 ? String(Math.floor(Number(key.rpmLimit))) : "20");
    setEditHasCostLimit(hasCostLimit);
    setEditCostLimit(hasCostLimit ? String(Number(key.costLimit)) : "");
    setEditKeyError("");
  };

  const closeEditKeyModal = () => {
    setEditingKey(null);
    setEditAllowedModels("");
    setEditRpmLimit("");
    setEditHasCostLimit(false);
    setEditCostLimit("");
    setEditKeyError("");
  };

  const handleUpdateKeyLimits = async () => {
    if (!editingKey) return;

    setEditKeyError("");

    let normalizedRpmLimit = null;
    if (editRpmLimit.trim()) {
      const rpm = Number(editRpmLimit);
      if (!Number.isFinite(rpm) || rpm <= 0) {
        setEditKeyError("RPM limit must be a positive number");
        return;
      }
      normalizedRpmLimit = Math.floor(rpm);
    }

    let normalizedCostLimit = null;
    if (editHasCostLimit) {
      const limit = Number(editCostLimit);
      if (!Number.isFinite(limit) || limit <= 0) {
        setEditKeyError("Cost limit must be a positive number");
        return;
      }
      normalizedCostLimit = Number(limit.toFixed(2));
    }

    const normalizedAllowedModels = editAllowedModels
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/keys/${editingKey.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasCostLimit: editHasCostLimit,
          costLimit: editHasCostLimit ? normalizedCostLimit : null,
          rpmLimit: normalizedRpmLimit,
          allowedModels: normalizedAllowedModels.length > 0 ? normalizedAllowedModels : null,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setKeys(prev => prev.map(k => (k.id === editingKey.id ? data.key : k)));
        closeEditKeyModal();
      } else {
        setEditKeyError(data.error || "Failed to update key limits");
      }
    } catch (error) {
      console.log("Error updating key limits:", error);
      setEditKeyError("Failed to update key limits");
    }
  };



  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive } : k));
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  const currentEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/v1`
    : "/v1";

  return (
    <div className="flex flex-col gap-8">
      {/* Endpoint Card */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">API Endpoint</h2>

        {/* Endpoint rows */}
        <div className="flex flex-col gap-2">
          {/* Local */}
          <EndpointRow
            label="Local"
            url={currentEndpoint}
            copyId="local_url"
            copied={copied}
            onCopy={copy}
          />
          {/* Cloudflare Tunnel */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[68px] text-center ${
              tunnelEnabled ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-sidebar text-text-muted"
            }`}>Tunnel</span>
            {tunnelEnabled && !tunnelLoading ? (
              <>
                <Input value={`${tunnelPublicUrl || tunnelUrl}/v1`} readOnly className="flex-1 font-mono text-sm" />
                <button
                  onClick={() => copy(`${tunnelPublicUrl || tunnelUrl}/v1`, "tunnel_url")}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">{copied === "tunnel_url" ? "check" : "content_copy"}</span>
                </button>
                <button
                  onClick={() => setShowDisableTunnelModal(true)}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Disable Tunnel"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : tunnelLoading ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  {tunnelProgress || "Creating tunnel..."}
                </div>
                <button
                  onClick={() => { setTunnelLoading(false); setTunnelProgress(""); }}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Stop"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : tunnelStatus?.type === "error" ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-red-300 dark:border-red-800 bg-red-500/5 text-sm text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {tunnelStatus.message}
                </div>
                <Button size="sm" icon="cloud_upload" onClick={() => setShowEnableTunnelModal(true)}>Enable</Button>
              </>
            ) : tunnelChecking ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  Checking...
                </div>
                <button
                  onClick={() => setTunnelChecking(false)}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Stop"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : (
              <Button
                size="sm"
                icon="cloud_upload"
                onClick={() => {
                  if (!requireApiKey) {
                    setTunnelStatus({ type: "error", message: "Security required: Enable \"Require API key\" before activating the tunnel." });
                    return;
                  }
                  setShowEnableTunnelModal(true);
                }}
                className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
              >
                Enable
              </Button>
            )}
          </div>

          {/* Tailscale */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[68px] text-center ${
              tsEnabled ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : "bg-sidebar text-text-muted"
            }`}>Tailscale</span>
            {tsEnabled && !tsLoading ? (
              <>
                <Input value={`${tsUrl}/v1`} readOnly className="flex-1 font-mono text-sm" />
                <button
                  onClick={() => copy(`${tsUrl}/v1`, "ts_url")}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">{copied === "ts_url" ? "check" : "content_copy"}</span>
                </button>
                <button
                  onClick={() => setShowDisableTsModal(true)}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Disable Tailscale"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : (tsLoading || tsConnecting) ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  {tsProgress || "Connecting..."}
                </div>
                <button
                  onClick={() => { setTsLoading(false); setTsConnecting(false); setTsProgress(""); }}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Stop"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : tsStatus?.type === "error" ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-red-300 dark:border-red-800 bg-red-500/5 text-sm text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {tsStatus.message}
                </div>
                <Button size="sm" icon="vpn_lock" onClick={handleOpenTsModal}>Enable</Button>
              </>
            ) : (
              <Button
                size="sm"
                icon="vpn_lock"
                onClick={handleOpenTsModal}
                className="bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white!"
              >
                Enable
              </Button>
            )}
          </div>
        </div>

        {/* Security warnings when tunnel or tailscale is active */}
        {(tunnelEnabled || tsEnabled) && (
          <div className="mt-4 flex flex-col gap-2">
            {!requireApiKey && (
              <SecurityWarning
                message="Require API key is disabled - your endpoint is publicly accessible without authentication."
                action={{ label: "Enable", href: "#require-api-key" }}
              />
            )}
            {(!requireLogin || !hasPassword) && (
              <SecurityWarning
                message={
                  !requireLogin
                    ? "Require login is disabled - anyone can access your dashboard via tunnel."
                    : "Dashboard uses the default password - change it in Profile settings."
                }
                action={{
                  label: !requireLogin ? "Enable" : "Change password",
                  href: "/dashboard/profile",
                }}
              />
            )}
          </div>
        )}

        {/* Tunnel dashboard access option */}
        {(tunnelEnabled || tsEnabled) && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
            <Toggle
              checked={tunnelDashboardAccess}
              onChange={() => handleTunnelDashboardAccess(!tunnelDashboardAccess)}
            />
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm">Allow dashboard access via tunnel</p>
              <Tooltip text="When enabled, the dashboard can be accessed through your tunnel or Tailscale URL (login still required). When disabled, dashboard access via tunnel/Tailscale is completely blocked." />
            </div>
          </div>
        )}
      </Card>

      {/* Token Saver (RTK) */}
      <Card id="rtk">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Token Saver</h2>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              Experimental
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="pr-4">
            <p className="font-medium">Compress tool output</p>
            <p className="text-sm text-text-muted">
              Auto-compress git diff / status / grep / find / ls / tree / logs in <code>tool_result</code> before sending to LLM. Check server console for <code>[RTK] saved ...</code> log.
            </p>
            <p className="text-xs text-text-muted mt-1">
              Inspired by{" "}
              <a
                href="https://github.com/rtk-ai/rtk"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                RTK (Rust Token Killer)
              </a>
              {" "}— ported to JavaScript. This feature is still under testing; disable it if you notice unexpected results.
            </p>
          </div>
          <Toggle
            checked={rtkEnabled}
            onChange={() => handleRtkEnabled(!rtkEnabled)}
          />
        </div>
      </Card>

      {/* API Keys */}
      <Card id="require-api-key">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <Button icon="add" onClick={() => setShowAddModal(true)}>
            Create Key
          </Button>
        </div>

        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
          <div>
            <p className="font-medium">Require API key</p>
            <p className="text-sm text-text-muted">
              Requests without a valid key will be rejected
            </p>
          </div>
          <Toggle
            checked={requireApiKey}
            onChange={() => handleRequireApiKey(!requireApiKey)}
          />
        </div>

        {keysLoading ? (
          <div className="flex flex-col gap-3">
            <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
            <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-[32px]">vpn_key</span>
            </div>
            <p className="text-text-main font-medium mb-1">No API keys yet</p>
            <p className="text-sm text-text-muted mb-4">Create your first API key to get started</p>
            <Button icon="add" onClick={() => setShowAddModal(true)}>
              Create Key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => {
              const visibleModels = Array.isArray(key.allowedModels) && key.allowedModels.length > 0
                ? key.allowedModels.slice(0, 2)
                : [];
              const hiddenCount = Array.isArray(key.allowedModels) && key.allowedModels.length > 2
                ? key.allowedModels.length - 2
                : 0;

              return (
                <div
                  key={key.id}
                  className={`group flex items-start justify-between gap-4 rounded-lg border border-border bg-surface/50 p-3 transition ${key.isActive === false ? "opacity-60" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-medium text-text-main">{key.name}</p>
                      {key.isActive === false && (
                        <span className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">
                          Paused
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <code className="rounded bg-black/5 px-2 py-0.5 font-mono text-xs text-text-muted dark:bg-white/5">
                        {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(key.id)}
                        className="rounded p-1 text-text-muted transition hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                        title={visibleKeys.has(key.id) ? "Hide" : "Show"}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {visibleKeys.has(key.id) ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                      <button
                        onClick={() => copy(key.key, key.id)}
                        className="rounded p-1 text-text-muted transition hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {copied === key.id ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span>
                        Chi Phí: {Number.isFinite(Number(key.costLimit)) && Number(key.costLimit) > 0
                          ? `$${Number(key.costLimit).toFixed(2)}`
                          : "Unlimited"}
                      </span>
                      <span>•</span>
                      <span>
                        RPM: {Number.isFinite(Number(key.rpmLimit)) && Number(key.rpmLimit) > 0
                          ? Math.floor(Number(key.rpmLimit))
                          : "Unlimited"}
                      </span>
                      <span>•</span>
                      <span>
                        Models: {Array.isArray(key.allowedModels) && key.allowedModels.length > 0
                          ? `${key.allowedModels.length} model${key.allowedModels.length > 1 ? "s" : ""}`
                          : "All"}
                      </span>
                    </div>

                    {visibleModels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {visibleModels.map((model) => (
                          <span key={model} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {model}
                          </span>
                        ))}
                        {hiddenCount > 0 && (
                          <span className="inline-flex items-center rounded-md bg-black/5 px-2 py-0.5 text-xs text-text-muted dark:bg-white/5">
                            +{hiddenCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditKeyModal(key)}
                      className="rounded p-1.5 text-text-muted transition hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <Toggle
                      size="sm"
                      checked={key.isActive ?? true}
                      onChange={(checked) => {
                        if (key.isActive && !checked) {
                          if (confirm(`Pause "${key.name}"?`)) {
                            handleToggleKey(key.id, checked);
                          }
                        } else {
                          handleToggleKey(key.id, checked);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="rounded p-1.5 text-red-500 transition hover:bg-red-500/10"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add Key Modal */}
      <Modal
        isOpen={showAddModal}
        title="Create API Key"
        onClose={() => {
          setShowAddModal(false);
          setNewKeyName("");
          setNewKeyHasLimit(false);
          setNewKeyCostLimit("");
          setCreateKeyError("");
        }}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Production Key"
          />

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-text-main">Limit cost</p>
              <p className="text-xs text-text-muted">Bật để giới hạn tổng chi phí cho key này</p>
            </div>
            <Toggle
              checked={newKeyHasLimit}
              onChange={(checked) => {
                setNewKeyHasLimit(checked);
                if (!checked) {
                  setNewKeyCostLimit("");
                  setCreateKeyError("");
                }
              }}
            />
          </div>

          {newKeyHasLimit && (
            <Input
              label="Cost Limit (USD)"
              type="number"
              min="0.01"
              step="0.01"
              value={newKeyCostLimit}
              onChange={(e) => setNewKeyCostLimit(e.target.value)}
              placeholder="10.00"
              hint="Khi tổng chi phí đạt ngưỡng này, key sẽ tự bị từ chối"
              error={createKeyError || undefined}
            />
          )}

          {createKeyError && !newKeyHasLimit && (
            <p className="text-xs text-red-500">{createKeyError}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>
              Create
            </Button>
            <Button
              onClick={() => {
                setShowAddModal(false);
                setNewKeyName("");
                setNewKeyHasLimit(false);
                setNewKeyCostLimit("");
                setCreateKeyError("");
              }}
              variant="ghost"
              fullWidth
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>


      {/* Edit Key Limits Modal */}
      <Modal
        isOpen={!!editingKey}
        title="Edit Key Limits"
        onClose={closeEditKeyModal}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-main">Allowed Models</p>
                <p className="text-xs text-text-muted">Để trống để cho phép tất cả.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllowedModelsModal(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add model
              </button>
            </div>

            {allowedModelsList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 rounded-lg bg-sidebar/40 p-2">
                {allowedModelsList.map((model) => (
                  <span key={model} className="inline-flex max-w-full items-center gap-1 rounded-md bg-background px-2 py-1 text-xs text-text-main">
                    <span className="truncate max-w-[240px]">{model}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllowedModel(model)}
                      className="rounded text-text-muted transition hover:text-red-500"
                      title="Remove model"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">All models are allowed.</p>
            )}

            <Input
              value={getAllowedModelsInputValue()}
              onChange={(e) => setAllowedModelsInputValue(e.target.value)}
              placeholder="gpt-4.1, claude-sonnet-4-5, gemini-2.5-pro"
            />
          </div>

          <Input
            label="RPM Limit"
            type="number"
            min="1"
            step="1"
            value={editRpmLimit}
            onChange={(e) => setEditRpmLimit(e.target.value)}
            placeholder="20"
            hint="Requests per minute"
          />

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-text-main">Limit cost</p>
              <p className="text-xs text-text-muted">Enable to cap total spend for this key</p>
            </div>
            <Toggle
              checked={editHasCostLimit}
              onChange={(checked) => {
                setEditHasCostLimit(checked);
                if (!checked) {
                  setEditCostLimit("");
                  setEditKeyError("");
                }
              }}
            />
          </div>

          {editHasCostLimit && (
            <Input
              label="Cost Limit (USD)"
              type="number"
              min="0.01"
              step="0.01"
              value={editCostLimit}
              onChange={(e) => setEditCostLimit(e.target.value)}
              placeholder="10.00"
              error={editKeyError || undefined}
            />
          )}

          {editKeyError && !editHasCostLimit && (
            <p className="text-xs text-red-500">{editKeyError}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleUpdateKeyLimits} fullWidth>
              Save
            </Button>
            <Button onClick={closeEditKeyModal} variant="ghost" fullWidth>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <ModelSelectModal
        isOpen={showAllowedModelsModal}
        onClose={() => setShowAllowedModelsModal(false)}
        onSelect={handleAddAllowedModel}
        selectedModel={null}
        activeProviders={activeProviders}
        title="Add Allowed Model"
        modelAliases={modelAliases}
      />

      {/* Created Key Modal */}
      <Modal
        isOpen={!!createdKey}
        title="API Key Created"
        onClose={() => setCreatedKey(null)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2 font-medium">
              Save this key now!
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This is the only time you will see this key. Store it securely.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={createdKey || ""}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="secondary"
              icon={copied === "created_key" ? "check" : "content_copy"}
              onClick={() => copy(createdKey, "created_key")}
            >
              {copied === "created_key" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button onClick={() => setCreatedKey(null)} fullWidth>
            Done
          </Button>
        </div>
      </Modal>

      {/* Enable Tunnel Modal */}
      <Modal
        isOpen={showEnableTunnelModal}
        title="Chọn Tunnel"
        onClose={() => setShowEnableTunnelModal(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">Chọn nhà cung cấp tunnel trước khi bật.</p>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => { setSelectedTunnelProvider("cloudflare"); handleEnableTunnel("cloudflare"); }}
              fullWidth
              className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
            >
              Cloudflare
            </Button>
            <Button
              onClick={() => { setSelectedTunnelProvider("ngrok"); handleEnableTunnel("ngrok"); }}
              fullWidth
              className="bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white!"
            >
              Ngrok
            </Button>
          </div>

          <Button onClick={() => setShowEnableTunnelModal(false)} variant="ghost" fullWidth>Hủy</Button>
        </div>
      </Modal>

      {/* Disable Cloudflare Tunnel Modal */}
      <Modal
        isOpen={showDisableTunnelModal}
        title="Disable Tunnel"
        onClose={() => !tunnelLoading && setShowDisableTunnelModal(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">The Cloudflare tunnel will be disconnected. Remote access via tunnel URL will stop working.</p>
          <div className="flex gap-2">
            <Button onClick={handleDisableTunnel} fullWidth disabled={tunnelLoading} className="bg-red-500! hover:bg-red-600! text-white!">
              {tunnelLoading ? "Disabling..." : "Disable"}
            </Button>
            <Button onClick={() => setShowDisableTunnelModal(false)} variant="ghost" fullWidth disabled={tunnelLoading}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Tailscale Modal */}
      <Modal
        isOpen={showTsModal}
        title="Tailscale Funnel"
        onClose={() => { if (!tsInstalling) { setShowTsModal(false); setTsSudoPassword(""); setTsStatus(null); } }}
      >
        <div className="flex flex-col gap-4">
          {/* Checking state */}
          {tsInstalled === null && (
            <p className="text-sm text-text-muted flex items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              Checking...
            </p>
          )}

          {/* Not installed */}
          {tsInstalled === false && !tsInstalling && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">Tailscale chưa được cài. Cài đặt để có link tunnel cố định (miễn phí, truy cập public).</p>
              <div className="flex gap-2">
                <Button
                  onClick={handleInstallTailscale}
                  fullWidth
                  className="bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white!"
                >
                  Install Tailscale
                </Button>
                <Button onClick={() => setShowTsModal(false)} variant="ghost" fullWidth>Cancel</Button>
              </div>
            </div>
          )}

          {/* Installing with progress log */}
          {tsInstalling && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                Installing Tailscale...
              </div>
              {tsInstallLog.length > 0 && (
                <div ref={tsLogRef} className="bg-black/5 dark:bg-white/5 rounded p-2 max-h-40 overflow-y-auto font-mono text-xs text-text-muted">
                  {tsInstallLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Installed: show Connect button */}
          {tsInstalled === true && !tsInstalling && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Tailscale installed
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const tab = window.open("", "tailscale_auth", "width=600,height=700");
                    if (tab) tab.document.write("<p style='font-family:sans-serif;text-align:center;margin-top:40px'>Connecting to Tailscale...</p>");
                    handleConnectTailscale(tab);
                  }}
                  fullWidth
                  className="bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white!"
                >
                  Connect
                </Button>
                <Button onClick={() => setShowTsModal(false)} variant="ghost" fullWidth>Cancel</Button>
              </div>
            </div>
          )}

          {tsStatus && <StatusAlert status={tsStatus} />}
        </div>
      </Modal>

      {/* Disable Tailscale Modal */}
      <Modal
        isOpen={showDisableTsModal}
        title="Disable Tailscale"
        onClose={() => !tsLoading && setShowDisableTsModal(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">Tailscale Funnel will be stopped. Remote access via Tailscale URL will stop working.</p>
          <div className="flex gap-2">
            <Button onClick={handleDisableTailscale} fullWidth disabled={tsLoading} className="bg-red-500! hover:bg-red-600! text-white!">
              {tsLoading ? "Disabling..." : "Disable"}
            </Button>
            <Button onClick={() => setShowDisableTsModal(false)} variant="ghost" fullWidth disabled={tsLoading}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Reusable endpoint row component */
function EndpointRow({ label, url, copyId, copied, onCopy, badge, actions }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[68px] text-center ${badge === "CF" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" :
          badge === "TS" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" :
            "bg-sidebar text-text-muted"
        }`}>{label}</span>
      <Input value={url} readOnly className="flex-1 font-mono text-sm" />
      <button
        onClick={() => onCopy(url, copyId)}
        className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0"
      >
        <span className="material-symbols-outlined text-[18px]">{copied === copyId ? "check" : "content_copy"}</span>
      </button>
      {actions}
    </div>
  );
}

/** Reusable status alert */
function StatusAlert({ status, className = "" }) {
  // Render URLs in message as clickable links
  const renderMessage = (msg) => {
    const parts = msg.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline font-medium">{part}</a>
        : part
    );
  };

  return (
    <div className={`p-2 rounded text-sm ${className} ${status.type === "success" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
        status.type === "warning" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
        status.type === "info" ? "bg-primary/50/10 text-primary dark:text-blue-400" :
          "bg-red-500/10 text-red-600 dark:text-red-400"
      }`}>
      {renderMessage(status.message)}
    </div>
  );
}

/** Inline tooltip, Claude Code CLI style */
function Tooltip({ text }) {
  return (
    <span className="relative group inline-flex items-center">
      <span className="material-symbols-outlined text-[14px] text-text-muted cursor-help">help</span>
      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-50 w-64 rounded bg-gray-900 dark:bg-gray-800 text-white text-xs px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
        {text}
      </span>
    </span>
  );
}

/** Security warning banner with optional action link */
function SecurityWarning({ message, action }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
      <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
      <p className="text-xs flex-1">{message}</p>
      {action && (
        <a
          href={action.href}
          className="text-xs font-medium underline shrink-0 hover:opacity-80"
          onClick={action.href.startsWith("#") ? (e) => {
            e.preventDefault();
            document.getElementById(action.href.slice(1))?.scrollIntoView({ behavior: "smooth" });
          } : undefined}
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
