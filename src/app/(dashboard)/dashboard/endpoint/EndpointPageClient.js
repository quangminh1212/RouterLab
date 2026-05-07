"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Modal from "@/shared/components/Modal";
import { CardSkeleton } from "@/shared/components/Loading";
import Toggle from "@/shared/components/Toggle";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { logger } from "@/lib/logger";

const EndpointApiKeysCard = dynamic(() => import("./components/EndpointApiKeysCard"), {
  ssr: false,
  loading: () => (
    <Card id="require-api-key">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <Button icon="add" disabled>
          Create Key
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
        <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
      </div>
    </Card>
  ),
});

const DeferredModelSelectModal = dynamic(() => import("@/shared/components/ModelSelectModal"), {
  ssr: false,
});

const DeferredTailscaleModals = dynamic(() => import("./components/EndpointTailscaleModals"), {
  ssr: false,
});

const TUNNEL_BENEFITS = [
  { icon: "public", title: "Access Anywhere", desc: "Use your API from any network" },
  { icon: "group", title: "Share Endpoint", desc: "Share URL with team members" },
  { icon: "code", title: "Use in Cursor/Cline", desc: "Connect AI tools remotely" },
  { icon: "lock", title: "Encrypted", desc: "End-to-end TLS via Cloudflare" },
];

function parseHostnameFromUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isKnownTunnelHost(hostname) {
  if (!hostname) return false;
  return hostname === "api.xlabrnd.com"
    || hostname.includes("trycloudflare.com")
    || hostname.includes("ngrok")
    || hostname.includes("tailscale")
    || hostname.endsWith(".ts.net");
}

const TUNNEL_PING_INTERVAL_MS = 2000;
const TUNNEL_PING_MAX_MS = 300000;
const DASHBOARD_FETCH_TIMEOUT_MS = 3000;
const DASHBOARD_BACKGROUND_RETRY_DELAY_MS = 1200;

async function fetchWithTimeout(input, init = {}, timeoutMs = DASHBOARD_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function retryInBackground(task) {
  setTimeout(() => {
    task().catch(() => {});
  }, DASHBOARD_BACKGROUND_RETRY_DELAY_MS);
}

function getCloudflareConnectorCleanupMessage(cleanup) {
  if (!cleanup?.skipped) return "";
  const permissions = Array.isArray(cleanup.requiredPermissions) && cleanup.requiredPermissions.length
    ? ` Required token permissions: ${cleanup.requiredPermissions.join(", ")}.`
    : "";
  if (cleanup.reason === "missing_config") {
    return `Cloudflare API token missing - cannot auto-switch connectors between machines.${permissions}`;
  }
  if (cleanup.reason === "missing_account_id") {
    return `Cloudflare account ID missing - set ${cleanup.recommendedEnv || "CLOUDFLARE_ACCOUNT_ID"} to enable auto-switch.${permissions}`;
  }
  if (cleanup.reason === "error" && /Authentication error|10000/i.test(cleanup.error || "")) {
    return `Cloudflare API token is valid but lacks connector/tunnel permissions - cannot auto-switch connectors.${permissions} You can update this token's permissions in Cloudflare, or replace it with another token that has the required scopes.`;
  }
  if (cleanup.reason === "error" && cleanup.error) {
    return `Cloudflare connector auto-switch unavailable: ${cleanup.error}.${permissions}`;
  }
  return "";
}

function getCloudflareDnsSetupMessage(dnsSetup) {
  if (!dnsSetup) return "";
  const permissions = Array.isArray(dnsSetup.requiredPermissions) && dnsSetup.requiredPermissions.length
    ? ` Required token permissions: ${dnsSetup.requiredPermissions.join(", ")}.`
    : "";
  if (dnsSetup.skipped && dnsSetup.reason === "missing_config") {
    return `Cloudflare DNS auto-setup skipped because zone/domain/tunnel config is incomplete.${permissions}`;
  }
  if (dnsSetup.skipped && dnsSetup.reason === "error") {
    const hint = /Authentication error|10000/i.test(dnsSetup.error || "")
      ? ` The token is accepted by Cloudflare but is missing the DNS scopes listed above. Update the token permissions or use another token with the required scopes.`
      : "";
    return `Cloudflare DNS auto-setup failed: ${dnsSetup.error || "unknown error"}.${permissions}${hint}`;
  }
  if (dnsSetup.changed) {
    return `Cloudflare DNS configured: ${dnsSetup.hostname} -> ${dnsSetup.target}`;
  }
  if (dnsSetup.skipped === false && dnsSetup.hostname && dnsSetup.target) {
    return `Cloudflare DNS already configured: ${dnsSetup.hostname} -> ${dnsSetup.target}`;
  }
  return "";
}

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
  const [editKeyName, setEditKeyName] = useState("");
  const [editAllowedModels, setEditAllowedModels] = useState("");
  const [editRpmLimit, setEditRpmLimit] = useState("");
  const [editHasCostLimit, setEditHasCostLimit] = useState(false);
  const [editCostLimit, setEditCostLimit] = useState("");
  const [modelAliases, setModelAliases] = useState({});
  const [activeProviders, setActiveProviders] = useState([]);
  const [showAllowedModelsModal, setShowAllowedModelsModal] = useState(false);
  const tunnelStatusRequestRef = useRef(null);
  const lastTunnelStatusFetchAtRef = useRef(0);
  const modelPickerRequestRef = useRef(null);
  const modelPickerLoadedRef = useRef(false);
  const apiKeysLoadedRef = useRef(false);

  const [requireApiKey, setRequireApiKey] = useState(false);
  const [requireLogin, setRequireLogin] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);
  const [tunnelDashboardAccess, setTunnelDashboardAccess] = useState(false);
  const [rtkEnabled, setRtkEnabledState] = useState(false);
  const [cavemanEnabled, setCavemanEnabledState] = useState(false);
  const [cavemanLevel, setCavemanLevelState] = useState("full");

  // Cloudflare Tunnel state
  const [tunnelCheckingPrimary, setTunnelCheckingPrimary] = useState(false);
  const [tunnelCheckingBackground, setTunnelCheckingBackground] = useState(false);
  const [cloudflareEnabled, setCloudflareEnabled] = useState(false);
  const [cloudflareUrl, setCloudflareUrl] = useState("");
  const [ngrokEnabled, setNgrokEnabled] = useState(false);
  const [ngrokUrl, setNgrokUrl] = useState("");
  const [selectedTunnelProvider, setSelectedTunnelProvider] = useState("cloudflare");
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelProgress, setTunnelProgress] = useState("");
  const [tunnelStatus, setTunnelStatus] = useState(null);
  const [tunnelServiceInstalled, setTunnelServiceInstalled] = useState(false);
  const [showEnableTunnelModal, setShowEnableTunnelModal] = useState(false);
  const [oauthCodeInput, setOauthCodeInput] = useState("");
  const [showDisableTunnelModal, setShowDisableTunnelModal] = useState(false);
  const [showDeferredApiKeysCard, setShowDeferredApiKeysCard] = useState(false);
  const [cloudflareResetLoading, setCloudflareResetLoading] = useState(false);
  const [cloudflareSwitchLoading, setCloudflareSwitchLoading] = useState(false);

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
  
  // Ngrok install state
  const [ngrokInstalled, setNgrokInstalled] = useState(null); // null=checking, true/false
  const [ngrokInstalling, setNgrokInstalling] = useState(false);
  const [ngrokInstallProgress, setNgrokInstallProgress] = useState(0);
  const tsLogRef = useRef(null);
  const tunnelCheckingPrimaryTimeoutRef = useRef(null);

  // API key visibility toggle state
  const [visibleKeys, setVisibleKeys] = useState(new Set());

  const { copied, copy } = useCopyToClipboard();

  // Auto-scroll install log
  useEffect(() => {
    if (tsLogRef.current) tsLogRef.current.scrollTop = tsLogRef.current.scrollHeight;
  }, [tsInstallLog]);

  useEffect(() => {
    return () => {
      if (tunnelCheckingPrimaryTimeoutRef.current) {
        clearTimeout(tunnelCheckingPrimaryTimeoutRef.current);
      }
    };
  }, []);

  function applyTunnelStatus(data = {}) {
    const providers = data.providers || {};
    const tailscaleData = data.tailscale || {};
    const tunnel = data.tunnel || {};

    setCloudflareEnabled(providers.cloudflare?.enabled || false);
    setCloudflareUrl(providers.cloudflare?.tunnelUrl || "");
    setTunnelServiceInstalled(!!providers.cloudflare?.serviceInstalled);
    
    setNgrokEnabled(providers.ngrok?.enabled || false);
    setNgrokUrl(providers.ngrok?.tunnelUrl || "");
    
    if (tunnel.leaseLocked && tunnel.lease?.ownerHostname) {
      const owner = tunnel.lease.ownerHostname || tunnel.lease.ownerMachineId || "another machine";
      setTunnelStatus({ type: "warning", message: `Tunnel API is currently active on ${owner}. Only one machine can expose the public API at a time.` });
      return;
    }

    if (providers.cloudflare?.enabled) {
      const cleanup = providers.cloudflare?.connectorCleanup;
      const cleanupMessage = getCloudflareConnectorCleanupMessage(cleanup);
      if (cleanupMessage) {
        setTunnelStatus({ type: "warning", message: cleanupMessage });
      } else if (providers.cloudflare?.serviceInstalled) {
        setTunnelStatus({ type: "success", message: "Cloudflare service installed - tunnel will persist after reboot" });
      } else {
        setTunnelStatus({ type: "warning", message: "Need Administrator to persist after reboot" });
      }
    }
    
    setTsUrl(tailscaleData.tunnelUrl || "");
    setTsEnabled(tailscaleData.enabled || false);
  }

  function applySettingsState(settings = {}) {
    setRequireApiKey(settings.requireApiKey === true);
    setRequireLogin(settings.requireLogin !== false);
    setHasPassword(settings.hasPassword || false);
    setTunnelDashboardAccess(settings.tunnelDashboardAccess === true);
    setCavemanEnabledState(settings.cavemanEnabled === true);
    setCavemanLevelState(settings.cavemanLevel || "full");
  }

  function startTunnelCheckingUi() {
    if (tunnelCheckingPrimaryTimeoutRef.current) {
      clearTimeout(tunnelCheckingPrimaryTimeoutRef.current);
    }
    setTunnelCheckingPrimary(true);
    setTunnelCheckingBackground(true);
    tunnelCheckingPrimaryTimeoutRef.current = setTimeout(() => {
      setTunnelCheckingPrimary(false);
    }, 1800);
  }

  function stopTunnelCheckingUi() {
    if (tunnelCheckingPrimaryTimeoutRef.current) {
      clearTimeout(tunnelCheckingPrimaryTimeoutRef.current);
      tunnelCheckingPrimaryTimeoutRef.current = null;
    }
    setTunnelCheckingPrimary(false);
    setTunnelCheckingBackground(false);
  }

  const fetchTunnelStatus = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && tunnelStatusRequestRef.current) {
      return tunnelStatusRequestRef.current;
    }
    if (!force && now - lastTunnelStatusFetchAtRef.current < 2500) {
      return null;
    }

    const requestPromise = (async () => {
    const traceId = createDashboardTraceId("endpoint-tunnel-status");
    const start = performance.now();
    startTunnelCheckingUi();

    logDashboardPerf("debug", "fetchTunnelStatus:start", { traceId }, { verbose: true });

    try {
      const responseStart = performance.now();
      const res = await fetchWithTimeout("/api/tunnel/status", {
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
      if (error?.name === "AbortError") {
        setTunnelStatus((prev) => prev || { type: "warning", message: "Tunnel status check timed out. Showing last known state." });
        retryInBackground(async () => {
          setTunnelCheckingBackground(true);
          try {
            const res = await fetch("/api/tunnel/status", { cache: "no-store" });
            if (!res.ok) return;
            applyTunnelStatus(await res.json());
          } finally {
            setTunnelCheckingBackground(false);
          }
        });
      }
      logDashboardPerf("error", "fetchTunnelStatus:error", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        error: error.message,
      }, { force: true });
      console.log("Error fetching tunnel status:", error);
    } finally {
      lastTunnelStatusFetchAtRef.current = Date.now();
      tunnelStatusRequestRef.current = null;
      stopTunnelCheckingUi();
    }
    })();

    tunnelStatusRequestRef.current = requestPromise;
    return requestPromise;
  }, []);

  const fetchModelPickerData = useCallback(async () => {
    if (modelPickerLoadedRef.current) {
      return null;
    }
    if (modelPickerRequestRef.current) {
      return modelPickerRequestRef.current;
    }

    const requestPromise = (async () => {
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

        if (providersRes.ok || aliasesRes.ok) {
          modelPickerLoadedRef.current = true;
        }
      } catch (error) {
        console.log("Error fetching model picker data:", error);
      } finally {
        modelPickerRequestRef.current = null;
      }
    })();

    modelPickerRequestRef.current = requestPromise;
    return requestPromise;
  }, []);

  const fetchBootstrap = useCallback(async () => {
    const traceId = createDashboardTraceId("endpoint-bootstrap");
    const start = performance.now();

    logDashboardPerf("debug", "fetchBootstrap:start", { traceId }, { verbose: true });

    try {
      const responseStart = performance.now();
      const res = await fetch("/api/dashboard/bootstrap", {
        cache: "no-store",
        headers: { "x-debug-trace-id": traceId },
      });
      const responseDurationMs = Math.round(performance.now() - responseStart);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load dashboard bootstrap");
      }

      const applyStart = performance.now();
      applySettingsState(data.settings);
      setRtkEnabledState(data.settings?.rtkEnabled || false);
      setCavemanEnabledState(data.settings?.cavemanEnabled === true);
      setCavemanLevelState(data.settings?.cavemanLevel || "full");
      const applyStateDurationMs = Math.round(performance.now() - applyStart);

      logDashboardPerf("info", "fetchBootstrap:done", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        responseDurationMs,
        applyStateDurationMs,
      });

    } catch (error) {
      logDashboardPerf("error", "fetchBootstrap:error", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        error: error.message,
      }, { force: true });
      console.log("Error fetching dashboard bootstrap:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchTunnelStatus]);

  useEffect(() => {
    if (loading) return;
    let idleId = null;
    let timeoutId = null;
    const scheduleTunnelStatus = () => {
      void fetchTunnelStatus();
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(scheduleTunnelStatus, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(scheduleTunnelStatus, 1200);
    }

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function" && idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [fetchTunnelStatus, loading]);

  const checkNgrokInstalled = async () => {
    setNgrokInstalled(null);
    try {
      const res = await fetch("/api/tunnel/ngrok-check");
      if (res.ok) {
        const data = await res.json();
        setNgrokInstalled(data.installed);
        return data;
      }
    } catch { /* ignore */ }
    setNgrokInstalled(false);
    return { installed: false };
  };

  useEffect(() => {
    let isDisposed = false;
    let idleId = null;
    let fallbackTimeoutId = null;

    const timer = setTimeout(() => {
      void fetchBootstrap();

      const scheduleNgrokCheck = () => {
        if (isDisposed) return;
        void checkNgrokInstalled();
      };

      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(scheduleNgrokCheck, { timeout: 3000 });
      } else {
        fallbackTimeoutId = setTimeout(scheduleNgrokCheck, 1200);
      }
    }, 0);

    return () => {
      isDisposed = true;
      clearTimeout(timer);
      if (fallbackTimeoutId !== null) clearTimeout(fallbackTimeoutId);
      if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function" && idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [fetchBootstrap]);

  useEffect(() => {
    let idleId = null;
    let timeoutId = null;

    const reveal = () => setShowDeferredApiKeysCard(true);
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(reveal, { timeout: 1800 });
    } else {
      timeoutId = setTimeout(reveal, 800);
    }

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function" && idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  useEffect(() => {
    if (!showAllowedModelsModal) return;
    void fetchModelPickerData();
  }, [fetchModelPickerData, showAllowedModelsModal]);

  const loadApiKeys = useCallback(async () => {
    if (apiKeysLoadedRef.current) return;
    setKeysLoading(true);
    try {
      const keysRes = await fetch("/api/keys", { cache: "no-store" });
      const keysData = await keysRes.json();
      if (keysRes.ok) {
        setKeys(keysData.keys || []);
        apiKeysLoadedRef.current = true;
      }
    } catch (error) {
      console.log("Error fetching API keys:", error);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showDeferredApiKeysCard) return;
    void loadApiKeys();
  }, [loadApiKeys, showDeferredApiKeysCard]);

  async function loadSettings() {
    const traceId = createDashboardTraceId("endpoint-settings");
    const start = performance.now();
    startTunnelCheckingUi();

    logDashboardPerf("debug", "loadSettings:start", { traceId }, { verbose: true });

    try {
      const settingsStart = performance.now();
      const tunnelStart = performance.now();
      const [settingsRes, statusRes] = await Promise.all([
        fetchWithTimeout("/api/settings", {
          cache: "no-store",
          headers: { "x-debug-trace-id": traceId, "x-debug-op": "loadSettings:settings" },
        }),
        fetchWithTimeout("/api/tunnel/status", {
          cache: "no-store",
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
      if (error?.name === "AbortError") {
        setTunnelStatus((prev) => prev || { type: "warning", message: "Tunnel check timed out. Please retry if needed." });
        retryInBackground(async () => {
          setTunnelCheckingBackground(true);
          try {
            const [settingsRes, statusRes] = await Promise.all([
              fetch("/api/settings", { cache: "no-store" }),
              fetch("/api/tunnel/status", { cache: "no-store" }),
            ]);
            if (settingsRes.ok) {
              const settings = await settingsRes.json();
              applySettingsState(settings);
              setRtkEnabledState(settings.rtkEnabled || false);
            }
            if (statusRes.ok) {
              applyTunnelStatus(await statusRes.json());
            }
          } finally {
            setTunnelCheckingBackground(false);
          }
        });
      }
      logDashboardPerf("error", "loadSettings:error", {
        traceId,
        durationMs: Math.round(performance.now() - start),
        error: error.message,
      }, { force: true });
      console.log("Error loading settings:", error);
    } finally {
      stopTunnelCheckingUi();
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
      if (res.ok) {
        setRequireApiKey(value);
      } else {
        const data = await res.json().catch(() => ({}));
        setTunnelStatus({ type: "error", message: data.error || "Failed to update Require API key" });
      }
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
      setTunnelStatus({ type: "error", message: "Failed to update Require API key" });
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

  const handleCavemanEnabled = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cavemanEnabled: value }),
      });
      if (res.ok) setCavemanEnabledState(value);
    } catch (error) {
      console.log("Error updating cavemanEnabled:", error);
    }
  };

  const handleCavemanLevel = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cavemanLevel: value }),
      });
      if (res.ok) setCavemanLevelState(value);
    } catch (error) {
      console.log("Error updating cavemanLevel:", error);
    }
  };

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
    const oauthCode = oauthCodeInput.trim();
    if (!oauthCode) {
      setTunnelStatus({ type: "error", message: "Authenticator code is required to enable tunnel" });
      return;
    }

    setSelectedTunnelProvider(provider);
    setShowEnableTunnelModal(false);
    setOauthCodeInput("");
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
        body: JSON.stringify({ provider, oauthCode }),
      });
      polling = false;
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.code === "TUNNEL_LEASE_CONFLICT") {
          const owner = data.lease?.ownerHostname || data.lease?.ownerMachineId || "another machine";
          setTunnelStatus({ type: "error", message: `Cannot enable: Tunnel API is already active on ${owner}` });
          return;
        }
        if (res.status === 503 && /Local origin is not ready/i.test(data.error || "")) {
          setTunnelStatus({ type: "error", message: "Cannot enable: Local origin (port 1212) is not ready. Start the router first." });
          return;
        }
        if (data.code === "OAUTH_CODE_REQUIRED" || data.code === "OAUTH_CODE_INVALID") {
          setTunnelStatus({ type: "error", message: "Cannot enable: Authenticator code is missing or invalid." });
          return;
        }
        if (provider === "ngrok" && /binary not found|not found in path|enoent/i.test(data.error || "")) {
          setNgrokInstalled(false);
        }
        setTunnelStatus({ type: "error", message: data.error || "Failed to enable tunnel" });
        return;
      }

      const url = data.publicUrl || data.tunnelUrl;
      if (!url) {
        setTunnelStatus({ type: "error", message: "No tunnel URL returned" });
        return;
      }

      if (provider === "cloudflare") {
        setCloudflareUrl(url);
        setCloudflareEnabled(true);
        setNgrokEnabled(false);
      } else if (provider === "ngrok") {
        setNgrokUrl(url);
        setNgrokEnabled(true);
        setCloudflareEnabled(false);
      }

      setTunnelServiceInstalled(!!data.serviceInstalled);
      
      if (provider === "cloudflare") {
        const dnsMessage = getCloudflareDnsSetupMessage(data.dnsSetup);
        const cleanupMessage = getCloudflareConnectorCleanupMessage(data.connectorCleanup);
        if (dnsMessage && data.dnsSetup?.skipped) {
          setTunnelStatus({ type: "warning", message: `${dnsMessage}${cleanupMessage ? ` ${cleanupMessage}` : ""}` });
        } else if (cleanupMessage) {
          setTunnelStatus({ type: "warning", message: cleanupMessage });
        } else if (dnsMessage) {
          setTunnelStatus({ type: "success", message: dnsMessage });
        } else if (data.serviceInstalled) {
          setTunnelStatus({ type: "success", message: "Cloudflare service installed - tunnel will persist after reboot" });
        } else {
          setTunnelStatus({ type: "warning", message: "Need Administrator to persist after reboot" });
        }
      }
      
      await pingTunnelHealth(url);
    } catch (error) {
      if (provider === "ngrok" && /binary not found|not found in path|enoent/i.test(error?.message || "")) {
        setNgrokInstalled(false);
      }
      setTunnelStatus({ type: "error", message: error.message });
    } finally {
      polling = false;
      setTunnelLoading(false);
      setTunnelProgress("");
    }
  };

  const ensureRequireApiKeyEnabled = async () => {
    if (requireApiKey) return true;
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) return false;
      const settings = await res.json();
      const enabled = settings.requireApiKey === true;
      setRequireApiKey(enabled);
      return enabled;
    } catch {
      return false;
    }
  };

  const handleEnableSecuredTunnel = async (provider) => {
    setSelectedTunnelProvider(provider);
    let enabled = await ensureRequireApiKeyEnabled();
    if (!enabled) {
      const keysRes = await fetch("/api/keys").catch(() => null);
      const keysData = keysRes?.ok ? await keysRes.json().catch(() => null) : null;
      const hasKeys = Array.isArray(keysData?.keys) && keysData.keys.length > 0;
      if (hasKeys) {
        setTunnelProgress("Auto-enabling API key requirement...");
        await handleRequireApiKey(true);
        enabled = true;
      } else {
        setTunnelStatus({ type: "error", message: "Security required: Create at least one API key before activating the tunnel." });
        return;
      }
    }
    handleEnableTunnel(provider);
  };

  const handleDisableTunnel = async () => {
    setTunnelLoading(true);
    setTunnelStatus(null);
    try {
      const res = await fetch("/api/tunnel/disable", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setCloudflareEnabled(false);
        setCloudflareUrl("");
        setNgrokEnabled(false);
        setNgrokUrl("");
        setShowDisableTunnelModal(false);
        setTunnelStatus({ type: "success", message: "Tunnel disabled" });
      } else if (data.reason === "lease_conflict") {
        const owner = data.lease?.ownerHostname || data.lease?.ownerMachineId || "another machine";
        setTunnelStatus({ type: "error", message: `Cannot disable: Tunnel is owned by ${owner}` });
      } else {
        setTunnelStatus({ type: "error", message: data.error || "Failed to disable tunnel" });
      }
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message });
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleForceResetCloudflare = async () => {
    setSelectedTunnelProvider("cloudflare");
    setCloudflareResetLoading(true);
    setTunnelLoading(true);
    setTunnelStatus(null);
    setTunnelProgress("Resetting Cloudflare connectors...");
    try {
      const res = await fetch("/api/tunnel/cloudflare-force-reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTunnelStatus({ type: "error", message: data.error || "Failed to reset Cloudflare connectors" });
        return;
      }

      const url = data.publicUrl || data.tunnelUrl || cloudflareUrl;
      if (url) {
        setCloudflareUrl(url);
        setCloudflareEnabled(true);
      }

      const deleted = Number(data.connectorReset?.deleted || 0);
      const resetMessage = data.connectorReset?.skipped
        ? (getCloudflareConnectorCleanupMessage(data.connectorReset) || "Cloudflare connector reset skipped")
        : `Cloudflare connectors reset complete${deleted > 0 ? ` (${deleted} deleted)` : ""}.`;

      setTunnelStatus({ type: data.connectorReset?.skipped ? "warning" : "success", message: resetMessage });

      if (url) {
        await pingTunnelHealth(url);
      }
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message || "Failed to reset Cloudflare connectors" });
    } finally {
      setCloudflareResetLoading(false);
      setTunnelLoading(false);
      setTunnelProgress("");
    }
  };

  const handleSwitchCloudflareToThisMachine = async () => {
    setSelectedTunnelProvider("cloudflare");
    setCloudflareSwitchLoading(true);
    setTunnelLoading(true);
    setTunnelStatus(null);
    setTunnelProgress("Switching Cloudflare tunnel to this machine...");
    try {
      const res = await fetch("/api/tunnel/cloudflare-switch-host", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTunnelStatus({ type: "error", message: data.error || "Failed to switch Cloudflare host" });
        return;
      }

      const url = data.publicUrl || data.tunnelUrl || cloudflareUrl;
      if (url) {
        setCloudflareUrl(url);
        setCloudflareEnabled(true);
      }

      const connectorCount = Number(data.connectorVerify?.connectorCount || 0);
      const streamCount = Number(data.connectorVerify?.streamCount || 0);
      const attemptText = data.attempts ? ` (attempt ${data.attempts})` : "";
      const verifyMessage = connectorCount === 1
        ? `Cloudflare switched to this machine${attemptText}. Active connectors: ${connectorCount}, streams: ${streamCount}.`
        : `Switch completed but verification is not single-host yet. Active connectors: ${connectorCount}.`;

      setTunnelStatus({ type: connectorCount === 1 ? "success" : "warning", message: verifyMessage });

      if (url) {
        await pingTunnelHealth(url);
      }
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message || "Failed to switch Cloudflare host" });
    } finally {
      setCloudflareSwitchLoading(false);
      setTunnelLoading(false);
      setTunnelProgress("");
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

      if (!res.ok && res.status === 409 && data.code === "TUNNEL_LEASE_CONFLICT") {
        const owner = data.lease?.ownerHostname || data.lease?.ownerMachineId || "another machine";
        setTsStatus({ type: "error", message: `Cannot enable: Tunnel API is already active on ${owner}` });
        return;
      }

      if (!res.ok && res.status === 503 && /Local origin is not ready/i.test(data.error || "")) {
        setTsStatus({ type: "error", message: "Cannot enable: Local origin (port 1212) is not ready. Start the router first." });
        return;
      }

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

      // Needs login: redirect pre-opened tab or keep manual-login waiting mode
      if (data.needsLogin) {
        let authUrl = data.authUrl || "";
        if (!authUrl) {
          try {
            const loginRes = await fetch("/api/tunnel/tailscale-login", { method: "POST" });
            if (loginRes.ok) {
              const loginData = await loginRes.json();
              authUrl = loginData?.authUrl || "";
            }
          } catch {
            // ignore fallback fetch error
          }
        }

        if (!authUrl) {
          authUrl = "https://login.tailscale.com/start";
        }

        if (tab) tab.location.href = authUrl;
        else window.open(authUrl, "tailscale_auth", "width=600,height=700");
        setTsProgress("Waiting for login...");
        let notLoggedInCount = 0;
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            setTsProgress("Checking login status...");
            const checkRes = await fetch("/api/tunnel/tailscale-check");
            const checkData = checkRes.ok ? await checkRes.json() : null;
            const isLoggedIn = Boolean(checkData?.loggedIn);

            if (!isLoggedIn) {
              notLoggedInCount += 1;
              if (notLoggedInCount >= 6 && checkData?.daemonRunning) {
                setTsStatus({
                  type: "warning",
                  message: "Tailscale service is running but this device is not joined yet. Open Tailscale app and complete 'tailscale up' login for this machine."
                });
              }
              setTsProgress("Waiting for login...");
              continue;
            }

            setTsProgress("Login detected. Starting funnel...");
            const res2 = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
            const data2 = await res2.json();
            if (!res2.ok && res2.status === 409 && data2.code === "TUNNEL_LEASE_CONFLICT") {
              const owner = data2.lease?.ownerHostname || data2.lease?.ownerMachineId || "another machine";
              setTsStatus({ type: "error", message: `Cannot enable: Tunnel API is already active on ${owner}` });
              return;
            }
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
              return;
            }
            if (data2.funnelNotEnabled && data2.enableUrl) {
              await pollFunnelEnable(data2.enableUrl, tab);
              return;
            }
            if (data2.needsLogin) {
              setTsProgress("Waiting for login...");
              continue;
            }
            setTsStatus({ type: "error", message: data2.error || "Failed to start funnel" });
            return;
          } catch { /* retry */ }
        }
        setTsStatus({ type: "error", message: "Login timed out. Website login alone is not enough; this machine must be added to tailnet in Tailscale client." });
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
        if (!res.ok && res.status === 409 && data.code === "TUNNEL_LEASE_CONFLICT") {
          const owner = data.lease?.ownerHostname || data.lease?.ownerMachineId || "another machine";
          setTsStatus({ type: "error", message: `Cannot enable: Tunnel API is already active on ${owner}` });
          return;
        }
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
      if (res.ok && data.success !== false) {
        setTsEnabled(false);
        setTsUrl("");
        setShowDisableTsModal(false);
        setTsStatus({ type: "success", message: "Tailscale disabled" });
      } else if (data.reason === "lease_conflict") {
        const owner = data.lease?.ownerHostname || data.lease?.ownerMachineId || "another machine";
        setTsStatus({ type: "error", message: `Cannot disable: Tunnel is owned by ${owner}` });
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

  const handleInstallNgrok = async () => {
    setSelectedTunnelProvider("ngrok");
    setNgrokInstalling(true);
    setNgrokInstallProgress(3);
    setTunnelStatus(null);
    const progressTimer = setInterval(() => {
      setNgrokInstallProgress((prev) => {
        if (prev >= 90) return prev;
        if (prev < 20) return prev + 7;
        if (prev < 50) return prev + 5;
        return prev + 2;
      });
    }, 700);
    try {
      const res = await fetch("/api/tunnel/ngrok-install", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setNgrokInstalled(true);
        setNgrokInstallProgress(100);
        setSelectedTunnelProvider("ngrok");
        setTunnelStatus({ type: "success", message: "Ngrok installed successfully. Enabling tunnel..." });
        await handleEnableTunnel("ngrok");
      } else {
        setSelectedTunnelProvider("ngrok");
        setTunnelStatus({ type: "error", message: data.error || "Failed to install ngrok" });
      }
    } catch (e) {
      setSelectedTunnelProvider("ngrok");
      setTunnelStatus({ type: "error", message: e.message });
    } finally {
      clearInterval(progressTimer);
      setNgrokInstalling(false);
      setTimeout(() => setNgrokInstallProgress(0), 1200);
    }
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
    setEditKeyName(typeof key.name === "string" ? key.name : "");
    setEditAllowedModels(Array.isArray(key.allowedModels) ? key.allowedModels.join(", ") : "");
    setEditRpmLimit(Number.isFinite(Number(key.rpmLimit)) && Number(key.rpmLimit) > 0 ? String(Math.floor(Number(key.rpmLimit))) : "20");
    setEditHasCostLimit(hasCostLimit);
    setEditCostLimit(hasCostLimit ? String(Number(key.costLimit)) : "");
    setEditKeyError("");
  };

  const closeEditKeyModal = () => {
    setEditingKey(null);
    setEditKeyName("");
    setEditAllowedModels("");
    setEditRpmLimit("");
    setEditHasCostLimit(false);
    setEditCostLimit("");
    setEditKeyError("");
  };

  const handleUpdateKeyLimits = async () => {
    if (!editingKey) return;

    setEditKeyError("");

    const normalizedName = editKeyName.trim();
    if (!normalizedName) {
      setEditKeyError("Key name is required");
      return;
    }

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
          name: normalizedName,
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
        setEditKeyError(data.error || "Failed to update key");
      }
    } catch (error) {
      console.log("Error updating key limits:", error);
      setEditKeyError("Failed to update key");
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
  const currentHostname = typeof window !== "undefined"
    ? window.location.hostname.toLowerCase()
    : "";
  const isViewingFromTunnelHost = !!currentHostname && (
    currentHostname === parseHostnameFromUrl(cloudflareUrl)
    || currentHostname === parseHostnameFromUrl(ngrokUrl)
    || currentHostname === parseHostnameFromUrl(tsUrl)
    || isKnownTunnelHost(currentHostname)
  );

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
          {/* Cloudflare */}
          {!isViewingFromTunnelHost && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[68px] text-center ${
              cloudflareEnabled ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-sidebar text-text-muted"
            }`}>Cloudflare</span>
            {cloudflareEnabled && !tunnelLoading ? (
              <>
                <Input value={`${cloudflareUrl}/v1`} readOnly className="flex-1 font-mono text-sm" />
                <button
                  onClick={() => copy(`${cloudflareUrl}/v1`, "cloudflare_url")}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">{copied === "cloudflare_url" ? "check" : "content_copy"}</span>
                </button>
                <button
                  onClick={() => { setSelectedTunnelProvider("cloudflare"); setShowDisableTunnelModal(true); }}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Disable Cloudflare"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : (tunnelLoading && selectedTunnelProvider === "cloudflare") ? (
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
            ) : (tunnelStatus?.type === "error" && selectedTunnelProvider === "cloudflare") ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-red-300 dark:border-red-800 bg-red-500/5 text-sm text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {tunnelStatus.message}
                </div>
                <Button size="sm" icon="restart_alt" onClick={handleForceResetCloudflare} disabled={cloudflareResetLoading}>
                  {cloudflareResetLoading ? "Resetting..." : "Force Reset"}
                </Button>
                <Button size="sm" icon="sync_alt" onClick={handleSwitchCloudflareToThisMachine} disabled={cloudflareSwitchLoading}>
                  {cloudflareSwitchLoading ? "Switching..." : "Switch Here"}
                </Button>
                <Button size="sm" icon="cloud_upload" onClick={() => { setSelectedTunnelProvider("cloudflare"); handleEnableTunnel("cloudflare"); }}>Enable</Button>
              </>
            ) : (tunnelStatus?.type === "success" && selectedTunnelProvider === "cloudflare") ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-green-300 dark:border-green-800 bg-green-500/5 text-sm text-green-600 dark:text-green-400">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  {tunnelStatus.message}
                </div>
              </>
            ) : (tunnelStatus?.type === "warning" && selectedTunnelProvider === "cloudflare") ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-yellow-300 dark:border-yellow-800 bg-yellow-500/5 text-sm text-yellow-600 dark:text-yellow-400">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {tunnelStatus.message}
                </div>
              </>
            ) : (tunnelCheckingPrimary && selectedTunnelProvider === "cloudflare") ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  Checking...
                </div>
                <button
                  onClick={stopTunnelCheckingUi}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Stop"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : false ? (
              <Button
                size="sm"
                icon="download"
                onClick={handleInstallNgrok}
                disabled={ngrokInstalling}
                className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
              >
                {ngrokInstalling ? `Installing... ${Math.max(0, Math.min(100, ngrokInstallProgress))}%` : "CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â i ngrok"}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  icon="restart_alt"
                  onClick={handleForceResetCloudflare}
                  disabled={cloudflareResetLoading}
                  className="bg-sidebar border border-border text-text-muted hover:text-primary"
                >
                  {cloudflareResetLoading ? "Resetting..." : "Force Reset"}
                </Button>
                <Button
                  size="sm"
                  icon="sync_alt"
                  onClick={handleSwitchCloudflareToThisMachine}
                  disabled={cloudflareSwitchLoading}
                  className="bg-sidebar border border-border text-text-muted hover:text-primary"
                >
                  {cloudflareSwitchLoading ? "Switching..." : "Switch Here"}
                </Button>
                <Button
                  size="sm"
                  icon="cloud_upload"
                  onClick={() => handleEnableSecuredTunnel("cloudflare")}
                  className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
                >
                  Enable
                </Button>
                {tunnelCheckingBackground && selectedTunnelProvider === "cloudflare" && (
                  <span className="material-symbols-outlined animate-spin text-[14px] text-text-muted" title="Checking tunnel status in background">
                    progress_activity
                  </span>
                )}
              </div>
            )}
          </div>
          )}

          {/* Ngrok */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[68px] text-center ${
              ngrokEnabled ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-sidebar text-text-muted"
            }`}>Ngrok</span>
            {ngrokEnabled && !tunnelLoading ? (
              <>
                <Input value={`${ngrokUrl}/v1`} readOnly className="flex-1 font-mono text-sm" />
                <button
                  onClick={() => copy(`${ngrokUrl}/v1`, "ngrok_url")}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">{copied === "ngrok_url" ? "check" : "content_copy"}</span>
                </button>
                <button
                  onClick={() => { setSelectedTunnelProvider("ngrok"); setShowDisableTunnelModal(true); }}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Disable Ngrok"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : (tunnelLoading && selectedTunnelProvider === "ngrok") ? (
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
            ) : (ngrokInstalled === false || (tunnelStatus?.type === "error" && /binary not found|not found in path|enoent/i.test(tunnelStatus?.message || ""))) ? (
              <Button
                size="sm"
                icon="download"
                onClick={handleInstallNgrok}
                disabled={ngrokInstalling}
                className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
              >
                {ngrokInstalling ? `Installing... ${Math.max(0, Math.min(100, ngrokInstallProgress))}%` : "CÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â i ngrok"}
              </Button>
            ) : (tunnelStatus?.type === "error" && selectedTunnelProvider === "ngrok") ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-red-300 dark:border-red-800 bg-red-500/5 text-sm text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {tunnelStatus.message}
                </div>
                <Button size="sm" icon="cloud_upload" onClick={() => { setSelectedTunnelProvider("ngrok"); handleEnableTunnel("ngrok"); }}>Enable</Button>
              </>
            ) : (tunnelCheckingPrimary && selectedTunnelProvider === "ngrok") ? (
              <>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  Checking...
                </div>
                <button
                  onClick={stopTunnelCheckingUi}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
                  title="Stop"
                >
                  <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                </button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  icon="cloud_upload"
                  onClick={() => handleEnableSecuredTunnel("ngrok")}
                  className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
                >
                  Enable
                </Button>
                {tunnelCheckingBackground && selectedTunnelProvider === "ngrok" && (
                  <span className="material-symbols-outlined animate-spin text-[14px] text-text-muted" title="Checking tunnel status in background">
                    progress_activity
                  </span>
                )}
              </>
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
        {(cloudflareEnabled || ngrokEnabled || tsEnabled) && (
          <div className="mt-4 flex flex-col gap-2">
            {cloudflareEnabled && tunnelServiceInstalled && tunnelStatus?.type === "success" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded border border-green-300 dark:border-green-800 bg-green-500/5 text-sm text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {tunnelStatus.message}
              </div>
            )}
            {cloudflareEnabled && tunnelStatus?.type === "warning" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded border border-yellow-300 dark:border-yellow-800 bg-yellow-500/5 text-sm text-yellow-600 dark:text-yellow-400">
                <span className="material-symbols-outlined text-sm">warning</span>
                {tunnelStatus.message}
              </div>
            )}
            {!requireApiKey && (
              <SecurityWarning
                message="Require API key is disabled - your endpoint is publicly accessible without authentication."
                action={{ label: "Enable", href: "#require-api-key" }}
              />
            )}
            {!requireLogin && (
              <SecurityWarning
                message="Require login is disabled - anyone can access your dashboard via tunnel. Google Authenticator login is recommended."
                action={{ label: "Enable", href: "/dashboard/profile" }}
              />
            )}
          </div>
        )}

        {/* Tunnel dashboard access option */}
        {(cloudflareEnabled || ngrokEnabled || tsEnabled) && (
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

      {/* Token Saver (RTK + Caveman) */}
      <Card id="rtk">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Token Saver</h2>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              Experimental
            </span>
          </div>
          <Link href="/dashboard/token-saver" className="text-xs text-primary hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">science</span>
            Preview & test
          </Link>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="pr-4">
            <p className="font-medium">RTK: Compress tool output</p>
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
              {" "}- ported to JavaScript. Typically saves 60-90% on command output.
            </p>
          </div>
          <Toggle
            checked={rtkEnabled}
            onChange={() => handleRtkEnabled(!rtkEnabled)}
          />
        </div>

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
          <div className="pr-4">
            <p className="font-medium">Caveman: Terse replies</p>
            <p className="text-sm text-text-muted">
              Inject a terse system instruction before dispatch to reduce output tokens while keeping code, paths, commands, errors, and warnings exact.
            </p>
            <p className="text-xs text-text-muted mt-1">
              Inspired by{" "}
              <a
                href="https://github.com/JuliusBrussee/caveman-claude"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                Caveman Claude
              </a>
              {" "}- typically saves 30-50% on prose output.
            </p>
          </div>
          <Toggle
            checked={cavemanEnabled}
            onChange={() => handleCavemanEnabled(!cavemanEnabled)}
          />
        </div>

        {cavemanEnabled && (
          <div className="flex items-center justify-between pt-3">
            <div className="pr-4">
              <p className="font-medium text-sm">Caveman intensity</p>
              <p className="text-xs text-text-muted">Lite keeps normal grammar, Full is terse, Ultra is maximum compression.</p>
            </div>
            <select
              value={cavemanLevel}
              onChange={(event) => handleCavemanLevel(event.target.value)}
              className="min-w-[120px] rounded-lg border border-border bg-input px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
            >
              <option value="lite">Lite</option>
              <option value="full">Full</option>
              <option value="ultra">Ultra</option>
            </select>
          </div>
        )}

        {(rtkEnabled && cavemanEnabled) && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">info</span>
              <div className="text-xs text-text-muted">
                <p className="font-medium text-text-main mb-1">Stacked mode active</p>
                <p>
                  RTK runs first to compress tool output, then Caveman guides concise replies. Combined savings usually reach 70-95% on coding-agent sessions.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* API Keys */}
      {showDeferredApiKeysCard ? (
        <EndpointApiKeysCard
          keysLoading={keysLoading}
          keys={keys}
          requireApiKey={requireApiKey}
          onToggleRequireApiKey={handleRequireApiKey}
          onOpenCreateKey={() => setShowAddModal(true)}
          visibleKeys={visibleKeys}
          maskKey={maskKey}
          onToggleKeyVisibility={toggleKeyVisibility}
          onCopyKey={copy}
          copied={copied}
          onEditKey={openEditKeyModal}
          onToggleKeyActive={handleToggleKey}
          onDeleteKey={handleDeleteKey}
        />
      ) : (
        <Card id="require-api-key">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <Button icon="add" disabled>
              Create Key
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
            <div className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          </div>
        </Card>
      )}

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
              <p className="text-xs text-text-muted">BÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­t ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ giÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºi hÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡n tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ng chi phÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ cho key nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â y</p>
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
              hint="Khi tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ng chi phÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡t ngÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ng nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â y, key sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â± bÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« chÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œi"
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


      {/* Edit API Key Modal */}
      <Modal
        isOpen={!!editingKey}
        title="Edit API Key"
        onClose={closeEditKeyModal}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            value={editKeyName}
            onChange={(e) => {
              setEditKeyName(e.target.value);
              if (editKeyError === "Key name is required") {
                setEditKeyError("");
              }
            }}
            placeholder="Production Key"
            error={editKeyError === "Key name is required" ? editKeyError : undefined}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-main">Allowed Models</p>
                <p className="text-xs text-text-muted">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ trÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œng ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ cho phÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©p tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥t cÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£.</p>
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

      {showAllowedModelsModal ? (
        <DeferredModelSelectModal
          isOpen={showAllowedModelsModal}
          onClose={() => setShowAllowedModelsModal(false)}
          onSelect={handleAddAllowedModel}
          selectedModel={null}
          activeProviders={activeProviders}
          title="Add Allowed Model"
          modelAliases={modelAliases}
        />
      ) : null}

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
        title="ChÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Ân Tunnel"
        onClose={() => { setShowEnableTunnelModal(false); setOauthCodeInput(""); }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">NhÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­p mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£ 6 sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« Google Authenticator, sau ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ chÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Ân tunnel.</p>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Authenticator Code</label>
            <Input
              placeholder="123456"
              value={oauthCodeInput}
              onChange={(e) => setOauthCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => { setSelectedTunnelProvider("cloudflare"); handleEnableTunnel("cloudflare"); }}
              fullWidth
              disabled={!oauthCodeInput.trim()}
              className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600 text-white!"
            >
              Cloudflare
            </Button>
            <Button
              onClick={() => { setSelectedTunnelProvider("ngrok"); handleEnableTunnel("ngrok"); }}
              fullWidth
              disabled={!oauthCodeInput.trim()}
              className="bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white!"
            >
              Ngrok
            </Button>
          </div>

          <Button onClick={() => { setShowEnableTunnelModal(false); setOauthCodeInput(""); }} variant="ghost" fullWidth>HÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§y</Button>
        </div>
      </Modal>

      {/* Disable Tunnel Modal */}
      <Modal
        isOpen={showDisableTunnelModal}
        title={`Disable ${selectedTunnelProvider === "ngrok" ? "Ngrok" : "Cloudflare"} Tunnel`}
        onClose={() => !tunnelLoading && setShowDisableTunnelModal(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            The {selectedTunnelProvider === "ngrok" ? "Ngrok" : "Cloudflare"} tunnel will be disconnected. Remote access via tunnel URL will stop working.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleDisableTunnel} fullWidth disabled={tunnelLoading} className="bg-red-500! hover:bg-red-600! text-white!">
              {tunnelLoading ? "Disabling..." : "Disable"}
            </Button>
            <Button onClick={() => setShowDisableTunnelModal(false)} variant="ghost" fullWidth disabled={tunnelLoading}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {(showTsModal || showDisableTsModal) ? (
        <DeferredTailscaleModals
          showTsModal={showTsModal}
          tsInstalling={tsInstalling}
          setShowTsModal={setShowTsModal}
          setTsSudoPassword={setTsSudoPassword}
          setTsStatus={setTsStatus}
          tsInstalled={tsInstalled}
          handleInstallTailscale={handleInstallTailscale}
          tsInstallLog={tsInstallLog}
          tsLogRef={tsLogRef}
          handleConnectTailscale={handleConnectTailscale}
          tsStatus={tsStatus}
          showDisableTsModal={showDisableTsModal}
          tsLoading={tsLoading}
          setShowDisableTsModal={setShowDisableTsModal}
          handleDisableTailscale={handleDisableTailscale}
        />
      ) : null}
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
