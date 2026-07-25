"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import Modal from "@/shared/components/Modal";
import ProviderIcon from "@/shared/components/ProviderIcon";
import Select from "@/shared/components/Select";
import Toggle from "@/shared/components/Toggle";
import { CardSkeleton } from "@/shared/components/Loading";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import {
  FREE_PROVIDERS,
  FREE_TIER_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
  getProviderIconPath,
  getProviderIconPathFromConfig,
  getProviderIconSources,
} from "@/shared/constants/providers";
import Link from "next/link";
import { getErrorCode, getRelativeTime } from "@/shared/utils";
import { useNotificationStore } from "@/store/notificationStore";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import ModelAvailabilityBadge from "./components/ModelAvailabilityBadge";

function getStatusDisplay(connected, error, errorCode) {
  const parts = [];
  if (connected > 0) {
    parts.push(
      <Badge key="connected" variant="success" size="sm" dot>
        {connected} Connected
      </Badge>,
    );
  }
  if (error > 0) {
    const errText = errorCode
      ? `${error} Error (${errorCode})`
      : `${error} Error`;
    parts.push(
      <Badge key="error" variant="error" size="sm" dot>
        {errText}
      </Badge>,
    );
  }
  if (parts.length === 0) {
    return <span className="text-text-muted">No connections</span>;
  }
  return parts;
}

function getConnectionErrorTag(connection) {
  if (!connection) return null;

  const explicitType = connection.lastErrorType;
  if (explicitType === "runtime_error") return "RUNTIME";
  if (
    explicitType === "upstream_auth_error" ||
    explicitType === "auth_missing" ||
    explicitType === "token_refresh_failed" ||
    explicitType === "token_expired"
  )
    return "AUTH";
  if (explicitType === "upstream_rate_limited") return "429";
  if (explicitType === "upstream_unavailable") return "5XX";
  if (explicitType === "network_error") return "NET";

  const numericCode = Number(connection.errorCode);
  if (Number.isFinite(numericCode) && numericCode >= 400)
    return String(numericCode);

  const fromMessage = getErrorCode(connection.lastError);
  if (fromMessage === "401" || fromMessage === "403") return "AUTH";
  if (fromMessage && fromMessage !== "ERR") return fromMessage;

  const msg = (connection.lastError || "").toLowerCase();
  if (
    msg.includes("runtime") ||
    msg.includes("not runnable") ||
    msg.includes("not installed")
  )
    return "RUNTIME";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("unauthorized")
  )
    return "AUTH";

  return "ERR";
}

const FEATURED_PROVIDER_IDS = [
  "openrouter",
  "openai",
  "claude",
  "gemini",
  "deepseek",
  "groq",
  "xai",
  "nvidia",
  "qwen-cloud",
  "qwencoder",
  "ollama",
  "github",
];

const CATEGORY_CHIPS = [
  { id: "all", label: "All", icon: "apps" },
  { id: "configured", label: "Configured", icon: "check_circle" },
  { id: "oauth", label: "OAuth", icon: "lock" },
  { id: "free", label: "Free", icon: "redeem" },
  { id: "apikey", label: "API Key", icon: "key" },
  { id: "web", label: "Web Cookie", icon: "cookie" },
  { id: "compatible", label: "Compatible", icon: "extension" },
];

export default function ProvidersPage() {
  const [connections, setConnections] = useState([]);
  const [providerNodes, setProviderNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCompatibleModal, setShowAddCompatibleModal] = useState(false);
  const [showAddAnthropicCompatibleModal, setShowAddAnthropicCompatibleModal] =
    useState(false);
  const [testingMode, setTestingMode] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [compactMode, setCompactMode] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("routerlab.providers.compact") === "1";
    } catch {
      return false;
    }
  });
  const notify = useNotificationStore();
  const searchQuery = useHeaderSearchStore((s) => s.query);
  const registerSearch = useHeaderSearchStore((s) => s.register);
  const unregisterSearch = useHeaderSearchStore((s) => s.unregister);

  useEffect(() => {
    registerSearch("Search name, id, alias...");
    return () => unregisterSearch();
  }, [registerSearch, unregisterSearch]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "routerlab.providers.compact",
        compactMode ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [compactMode]);

  const matchSearch = (providerOrName, maybeId) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (typeof providerOrName === "string") {
      const id = String(maybeId || "").toLowerCase();
      const name = providerOrName.toLowerCase();
      return name.includes(q) || id.includes(q);
    }
    const p = providerOrName || {};
    const hay = [p.name, p.id, p.alias, maybeId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };

  const showSection = (sectionId) =>
    categoryFilter === "all" || categoryFilter === sectionId;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connectionsRes, nodesRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/provider-nodes"),
        ]);
        const connectionsData = await connectionsRes.json();
        const nodesData = await nodesRes.json();
        if (connectionsRes.ok)
          setConnections(connectionsData.connections || []);
        if (nodesRes.ok) setProviderNodes(nodesData.nodes || []);
      } catch (error) {
        console.log("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getProviderStats = (providerId, authType) => {
    const providerConnections = connections.filter(
      (c) => c.provider === providerId && c.authType === authType,
    );

    const getEffectiveStatus = (conn) => {
      const isCooldown = Object.entries(conn).some(
        ([k, v]) =>
          k.startsWith("modelLock_") && v && new Date(v).getTime() > Date.now(),
      );
      return conn.testStatus === "unavailable" && !isCooldown
        ? "active"
        : conn.testStatus;
    };

    const connected = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "active" || status === "success";
    }).length;

    const errorConns = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return (
        status === "error" || status === "expired" || status === "unavailable"
      );
    });

    const error = errorConns.length;
    const total = providerConnections.length;
    const allDisabled =
      total > 0 && providerConnections.every((c) => c.isActive === false);

    const latestError = errorConns.sort(
      (a, b) => new Date(b.lastErrorAt || 0) - new Date(a.lastErrorAt || 0),
    )[0];
    const errorCode = latestError ? getConnectionErrorTag(latestError) : null;
    const errorTime = latestError?.lastErrorAt
      ? getRelativeTime(latestError.lastErrorAt)
      : null;

    return { connected, error, total, errorCode, errorTime, allDisabled };
  };

  // Toggle all connections for a provider on/off
  const handleToggleProvider = async (providerId, authType, newActive) => {
    const providerConns = connections.filter(
      (c) => c.provider === providerId && c.authType === authType,
    );
    setConnections((prev) =>
      prev.map((c) =>
        c.provider === providerId && c.authType === authType
          ? { ...c, isActive: newActive }
          : c,
      ),
    );
    await Promise.allSettled(
      providerConns.map((c) =>
        fetch(`/api/providers/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newActive }),
        }),
      ),
    );
  };

  const handleBatchTest = async (mode, providerId = null) => {
    if (testingMode) return;
    setTestingMode(mode === "provider" ? providerId : mode);
    setTestResults(null);
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, providerId }),
      });
      const data = await res.json();
      setTestResults(data);
      if (data.summary) {
        const { passed, failed, total } = data.summary;
        if (failed === 0) notify.success(`All ${total} tests passed`);
        else notify.warning(`${passed}/${total} passed, ${failed} failed`);
      }
    } catch (error) {
      setTestResults({ error: "Test request failed" });
      notify.error("Provider test failed");
    } finally {
      setTestingMode(null);
    }
  };


  const sortProvidersByConfigured = (items, resolveId, resolveAuthType) => {
    return [...items].sort((left, right) => {
      const leftStats = getProviderStats(resolveId(left), resolveAuthType(left));
      const rightStats = getProviderStats(resolveId(right), resolveAuthType(right));
      const leftConfigured = leftStats.total > 0 ? 1 : 0;
      const rightConfigured = rightStats.total > 0 ? 1 : 0;
      if (leftConfigured !== rightConfigured) return rightConfigured - leftConfigured;
      const leftName = String(left?.provider?.name || left?.name || left?.[1]?.name || "").toLowerCase();
      const rightName = String(right?.provider?.name || right?.name || right?.[1]?.name || "").toLowerCase();
      return leftName.localeCompare(rightName);
    });
  };

  const compatibleProviders = providerNodes
    .filter((node) => node.type === "openai-compatible")
    .map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name || "OpenAI Compatible",
      color: "#10A37F",
      textIcon: "OC",
      apiType: node.apiType,
      prefix: node.prefix,
      baseUrl: node.baseUrl,
    }))
    .filter((p) => matchSearch(p, p.id));

  const anthropicCompatibleProviders = providerNodes
    .filter((node) => node.type === "anthropic-compatible")
    .map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name || "Anthropic Compatible",
      color: "#D97757",
      textIcon: "AC",
      prefix: node.prefix,
      baseUrl: node.baseUrl,
    }))
    .filter((p) => matchSearch(p, p.id));

  const oauthEntries = sortProvidersByConfigured(
    Object.entries(OAUTH_PROVIDERS).filter(
      ([key, info]) => !info.hidden && matchSearch(info, key),
    ),
    ([key]) => key,
    () => "oauth",
  );
  const freeEntries = sortProvidersByConfigured(
    Object.entries(FREE_PROVIDERS).filter(
      ([key, info]) => !info.hidden && matchSearch(info, key),
    ),
    ([key]) => key,
    () => "free",
  );
  const freeTierEntries = sortProvidersByConfigured(
    Object.entries(FREE_TIER_PROVIDERS).filter(
      ([key, info]) => !info.hidden && matchSearch(info, key),
    ),
    ([key]) => key,
    () => "free",
  );
  const apikeyEntries = Object.entries(APIKEY_PROVIDERS).filter(
    ([key, info]) =>
      !info.hidden &&
      (info.serviceKinds ?? ["llm"]).includes("llm") &&
      matchSearch(info, key),
  );
  const webCookieEntries = sortProvidersByConfigured(
    Object.entries(WEB_COOKIE_PROVIDERS).filter(
      ([key, info]) => !info.hidden && matchSearch(info, key),
    ),
    ([key]) => key,
    () => "apikey",
  );

  const mergedApiKeyLikeProviders = sortProvidersByConfigured([
    ...apikeyEntries
      .map(([key, info]) => ({
        kind: "fixed",
        key,
        provider: info,
      })),
  ], (entry) => entry.key, (entry) => entry.kind === "compatible" ? "apikey" : "apikey");

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const displayedCompatibleProviders = sortProvidersByConfigured(
    [
      ...compatibleProviders,
      ...anthropicCompatibleProviders,
    ],
    (info) => info.id,
    () => "apikey",
  );


  const isConfiguredProvider = (providerId, authType) => getProviderStats(providerId, authType).total > 0;

  const configuredProviders = sortProvidersByConfigured([
    ...oauthEntries
      .filter(([key]) => isConfiguredProvider(key, "oauth"))
      .map(([key, info]) => ({ kind: "oauth", key, provider: info, authType: "oauth", cardType: "provider" })),
    ...freeEntries
      .filter(([key]) => isConfiguredProvider(key, "oauth"))
      .map(([key, info]) => ({ kind: "free", key, provider: info, authType: "free", cardType: "provider" })),
    ...freeTierEntries
      .filter(([key]) => isConfiguredProvider(key, "apikey"))
      .map(([key, info]) => ({ kind: "free-tier", key, provider: info, authType: "apikey", cardType: "apikey" })),
    ...mergedApiKeyLikeProviders
      .filter((entry) => isConfiguredProvider(entry.key, "apikey"))
      .map((entry) => ({ ...entry, authType: "apikey", cardType: "apikey" })),
    ...displayedCompatibleProviders
      .filter((info) => isConfiguredProvider(info.id, "apikey"))
      .map((info) => ({ kind: "compatible-only", key: info.id, provider: info, authType: "compatible", cardType: "apikey" })),
  ], (entry) => entry.key, (entry) => entry.authType === "free" ? "oauth" : (entry.authType === "oauth" ? "oauth" : "apikey"));

  const configuredProviderIds = new Set(configuredProviders.map((entry) => `${entry.cardType}:${entry.key}`));
  const unconfiguredOAuthEntries = oauthEntries.filter(([key]) => !configuredProviderIds.has(`provider:${key}`));
  const unconfiguredFreeEntries = freeEntries.filter(([key]) => !configuredProviderIds.has(`provider:${key}`));
  const unconfiguredFreeTierEntries = freeTierEntries.filter(([key]) => !configuredProviderIds.has(`apikey:${key}`));
  const unconfiguredApiKeyLikeProviders = mergedApiKeyLikeProviders.filter((entry) => !configuredProviderIds.has(`apikey:${entry.key}`));
  const unconfiguredCompatibleProviders = displayedCompatibleProviders.filter((info) => !configuredProviderIds.has(`apikey:${info.id}`));

  const unconfiguredWebEntries = webCookieEntries.filter(
    ([key]) => !configuredProviderIds.has(`apikey:${key}`),
  );

  const hasAnyResult =
    configuredProviders.length > 0 ||
    unconfiguredOAuthEntries.length > 0 ||
    unconfiguredFreeEntries.length > 0 ||
    unconfiguredFreeTierEntries.length > 0 ||
    unconfiguredApiKeyLikeProviders.length > 0 ||
    unconfiguredCompatibleProviders.length > 0 ||
    unconfiguredWebEntries.length > 0;

  const gridClass = compactMode
    ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    : "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4";

  // Featured strip: known popular providers still matching search (9router-style quick pick)
  const featuredPool = [
    ...oauthEntries.map(([key, info]) => ({ key, info, authType: "oauth", card: "provider" })),
    ...freeEntries.map(([key, info]) => ({ key, info, authType: "free", card: "provider" })),
    ...freeTierEntries.map(([key, info]) => ({ key, info, authType: "apikey", card: "apikey" })),
    ...apikeyEntries.map(([key, info]) => ({ key, info, authType: "apikey", card: "apikey" })),
  ];
  const featuredEntries = FEATURED_PROVIDER_IDS.map((id) =>
    featuredPool.find((e) => e.key === id),
  ).filter(Boolean);

  const sectionVisible = {
    configured: showSection("configured") || showSection("all"),
    oauth: showSection("oauth") || showSection("all"),
    free: showSection("free") || showSection("all"),
    apikey: showSection("apikey") || showSection("all"),
    web: showSection("web") || showSection("all"),
    compatible: showSection("compatible") || showSection("all"),
  };
  // When filtering a single category, hide "configured" split except for configured chip
  if (categoryFilter === "configured") {
    Object.assign(sectionVisible, {
      oauth: false,
      free: false,
      apikey: false,
      web: false,
      compatible: false,
      configured: true,
    });
  } else if (categoryFilter !== "all") {
    sectionVisible.configured = false;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      {/* Toolbar — 9router / OmniRoute style filters */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-3 border-b border-border/60 bg-bg/90 px-1 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:bg-surface/80 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {CATEGORY_CHIPS.map((chip) => {
              const active = categoryFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCategoryFilter(chip.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-bg text-text-muted hover:border-primary/30 hover:text-text-main"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{chip.icon}</span>
                  {chip.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setCompactMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              compactMode
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-bg text-text-muted hover:text-text-main"
            }`}
            title="Compact grid (9router density)"
          >
            <span className="material-symbols-outlined text-[16px]">
              {compactMode ? "grid_view" : "view_agenda"}
            </span>
            {compactMode ? "Compact" : "Comfort"}
          </button>
        </div>
        {featuredEntries.length > 0 && categoryFilter === "all" && !searchQuery.trim() && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              Featured
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {featuredEntries.map((entry) => (
                <Link
                  key={`feat-${entry.key}`}
                  href={`/dashboard/providers/${entry.key}`}
                  className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border bg-bg px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <ProviderIcon
                    src={getProviderIconSources(entry.info)}
                    alt={entry.info.name}
                    size={18}
                    className="shrink-0"
                    fallbackText={entry.info.textIcon || entry.key.slice(0, 2).toUpperCase()}
                    fallbackColor={entry.info.color}
                  />
                  <span className="min-w-0 truncate font-medium text-text-main">
                    {entry.info.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {!hasAnyResult && (
        <div className="text-center py-8 border border-dashed border-border rounded-xl">
          <span className="material-symbols-outlined text-[32px] text-text-muted mb-2">
            search_off
          </span>
          <p className="text-text-muted text-sm">No providers match your search</p>
        </div>
      )}

      {sectionVisible.configured && configuredProviders.length > 0 && (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">Configured Providers</h2>
          <span className="text-xs text-text-muted">Providers with API key or configured connection</span>
        </div>
        <div className={gridClass}>
          {configuredProviders.map((entry) => (
            entry.cardType === "provider" ? (
              <ProviderCard
                key={`${entry.cardType}:${entry.key}`}
                providerId={entry.key}
                provider={entry.provider}
                stats={getProviderStats(entry.key, entry.authType === "free" ? "oauth" : entry.authType)}
                authType={entry.authType}
                onToggle={(active) => handleToggleProvider(entry.key, entry.authType === "free" ? "oauth" : entry.authType, active)}
              />
            ) : (
              <ApiKeyProviderCard
                key={`${entry.cardType}:${entry.key}`}
                providerId={entry.key}
                provider={entry.provider}
                stats={getProviderStats(entry.key, "apikey")}
                authType={entry.authType}
                onToggle={(active) => handleToggleProvider(entry.key, "apikey", active)}
              />
            )
          ))}
        </div>
      </div>
      )}

      {/* OAuth Providers */}
      {sectionVisible.oauth && unconfiguredOAuthEntries.length > 0 && (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
            OAuth Providers
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ModelAvailabilityBadge />
            <button
              onClick={() => handleBatchTest("oauth")}
              disabled={!!testingMode}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:w-auto sm:py-1.5 ${
                testingMode === "oauth"
                  ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                  : "bg-bg border-border text-text-muted hover:text-text-main hover:border-primary/40"
              }`}
              title="Test all OAuth connections"
              aria-label="Test all OAuth connections"
            >
              <span
                className={`material-symbols-outlined text-[14px]${testingMode === "oauth" ? " animate-spin" : ""}`}
              >
                play_arrow
              </span>
              {testingMode === "oauth" ? "Testing..." : "Test All"}
            </button>
          </div>
        </div>
        <div className={gridClass}>
          {unconfiguredOAuthEntries.map(([key, info]) => (
            <ProviderCard
              key={key}
              providerId={key}
              provider={info}
              stats={getProviderStats(key, "oauth")}
              authType="oauth"
              onToggle={(active) => handleToggleProvider(key, "oauth", active)}
            />
          ))}
        </div>
      </div>
      )}

      {/* Free Tier Providers */}
      {sectionVisible.free && (unconfiguredFreeEntries.length > 0 || unconfiguredFreeTierEntries.length > 0) && (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
            Free Tier Providers
          </h2>
          <button
            onClick={() => handleBatchTest("free")}
            disabled={!!testingMode}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:w-auto sm:py-1.5 ${
              testingMode === "free"
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-bg border-border text-text-muted hover:text-text-main hover:border-primary/40"
            }`}
            title="Test all Free connections"
            aria-label="Test all Free provider connections"
          >
            <span
              className={`material-symbols-outlined text-[14px]${testingMode === "free" ? " animate-spin" : ""}`}
            >
              play_arrow
            </span>
            {testingMode === "free" ? "Testing..." : "Test All"}
          </button>
        </div>
        <div className={gridClass}>
          {unconfiguredFreeEntries.map(([key, info]) => (
            <ProviderCard
              key={key}
              providerId={key}
              provider={info}
              stats={getProviderStats(key, "oauth")}
              authType="free"
              onToggle={(active) => handleToggleProvider(key, "oauth", active)}
            />
          ))}
          {unconfiguredFreeTierEntries.map(([key, info]) => (
            <ApiKeyProviderCard
              key={key}
              providerId={key}
              provider={info}
              stats={getProviderStats(key, "apikey")}
              authType="apikey"
              onToggle={(active) => handleToggleProvider(key, "apikey", active)}
            />
          ))}
        </div>
      </div>
      )}

      {/* API Key Providers - fixed list */}
      {sectionVisible.apikey && unconfiguredApiKeyLikeProviders.length > 0 && (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
            API Key Providers{" "}
          </h2>
          <button
            onClick={() => handleBatchTest("apikey")}
            disabled={!!testingMode}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:w-auto sm:py-1.5 ${
              testingMode === "apikey"
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-bg border-border text-text-muted hover:text-text-main hover:border-primary/40"
            }`}
            title="Test all API Key connections"
            aria-label="Test all API Key connections"
          >
            <span
              className={`material-symbols-outlined text-[14px]${testingMode === "apikey" ? " animate-spin" : ""}`}
            >
              play_arrow
            </span>
            {testingMode === "apikey" ? "Testing..." : "Test All"}
          </button>
        </div>
        <div className={gridClass}>
          {unconfiguredApiKeyLikeProviders.map((entry) => (
            <ApiKeyProviderCard
              key={entry.key}
              providerId={entry.key}
              provider={entry.provider}
              stats={getProviderStats(entry.key, "apikey")}
              authType={entry.kind === "compatible" ? "compatible" : "apikey"}
              onToggle={(active) => handleToggleProvider(entry.key, "apikey", active)}
            />
          ))}
        </div>
      </div>
      )}

      {/* Web Cookie Providers — 9router/Omni style (browser session) */}
      {sectionVisible.web && unconfiguredWebEntries.length > 0 && (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
              Web Cookie Providers
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Dùng cookie/session trình duyệt (ToS risk). Grok-web & Perplexity-web chạy ổn định hơn các web khác.
            </p>
          </div>
        </div>
        <div className={gridClass}>
          {unconfiguredWebEntries.map(([key, info]) => (
            <ApiKeyProviderCard
              key={key}
              providerId={key}
              provider={info}
              stats={getProviderStats(key, "apikey")}
              authType="apikey"
              onToggle={(active) => handleToggleProvider(key, "apikey", active)}
            />
          ))}
        </div>
      </div>
      )}

      {/* API Key Compatible Providers - dynamic (OpenAI/Anthropic compatible) */}
      {sectionVisible.compatible && (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
            API Key Compatible Providers{" "}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:w-auto">
            {/* {(compatibleProviders.length > 0 || anthropicCompatibleProviders.length > 0) && (
              <button
                onClick={() => handleBatchTest("compatible")}
                disabled={!!testingMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${testingMode === "compatible"
                  ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                  : "bg-bg border-border text-text-muted hover:text-text-main hover:border-primary/40"
                  }`}
                title="Test all Compatible connections"
              >
                <span className={`material-symbols-outlined text-[14px]${testingMode === "compatible" ? " animate-spin" : ""}`}>
                  play_arrow
                </span>
                {testingMode === "compatible" ? "Testing..." : "Test All"}
              </button>
            )} */}
            <Button
              size="sm"
              icon="add"
              onClick={() => setShowAddAnthropicCompatibleModal(true)}
              className="w-full sm:w-auto"
            >
              Add Anthropic Compatible
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="add"
              onClick={() => setShowAddCompatibleModal(true)}
              className="w-full !bg-white !text-black hover:!bg-gray-100 sm:w-auto"
            >
              Add OpenAI Compatible
            </Button>
          </div>
        </div>
        {unconfiguredCompatibleProviders.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <span className="material-symbols-outlined text-[32px] text-text-muted mb-2">
              extension
            </span>
            <p className="text-text-muted text-sm">
              No compatible providers added yet
            </p>
            <p className="text-text-muted text-xs mt-1">
              Use the buttons above to add OpenAI or Anthropic compatible
              endpoints
            </p>
          </div>
        ) : (
          <div className={gridClass}>
            {unconfiguredCompatibleProviders.map((info) => (
              <ApiKeyProviderCard
                key={info.id}
                providerId={info.id}
                provider={info}
                stats={getProviderStats(info.id, "apikey")}
                authType="compatible"
                onToggle={(active) =>
                  handleToggleProvider(info.id, "apikey", active)
                }
              />
            ))}
          </div>
        )}
      </div>
      )}

      <AddOpenAICompatibleModal
        isOpen={showAddCompatibleModal}
        onClose={() => setShowAddCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddCompatibleModal(false);
        }}
      />
      <AddAnthropicCompatibleModal
        isOpen={showAddAnthropicCompatibleModal}
        onClose={() => setShowAddAnthropicCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddAnthropicCompatibleModal(false);
        }}
      />

      {/* Test Results Modal */}
      {testResults && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[6vh] sm:pt-[10vh]"
          onClick={() => setTestResults(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-surface border border-border rounded-xl w-full max-w-[600px] max-h-[86vh] sm:max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-surface/95 backdrop-blur-sm rounded-t-xl">
              <h3 className="font-semibold">Test Results</h3>
              <button
                onClick={() => setTestResults(null)}
                className="p-1 rounded-lg hover:bg-bg text-text-muted hover:text-text-main transition-colors"
                aria-label="Close test results"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5">
              <ProviderTestResultsView results={testResults} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ providerId, provider, stats, authType, onToggle }) {
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isNoAuth = !!provider.noAuth;

  const dotColors = {
    free: "bg-green-500",
    oauth: "bg-blue-500",
    apikey: "bg-amber-500",
    compatible: "bg-orange-500",
  };
  const dotLabels = {
    free: "Free",
    oauth: "OAuth",
    apikey: "API Key",
    compatible: "Compatible",
  };

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group min-w-0">
      <Card
        padding="xs"
        className={`h-full hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${allDisabled ? "opacity-50" : ""}`}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="size-8 shrink-0 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `${provider.color?.length > 7 ? provider.color : provider.color + "15"}`,
              }}
            >
              <ProviderIcon
                src={getProviderIconSources(provider)}
                alt={provider.name}
                size={30}
                className="object-contain rounded-lg max-w-[32px] max-h-[32px]"
                fallbackText={
                  provider.textIcon || provider.id.slice(0, 2).toUpperCase()
                }
                fallbackColor={provider.color}
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{provider.name}</h3>
              <div className="flex min-w-0 items-center gap-1.5 text-xs flex-wrap">
                {allDisabled ? (
                  <Badge variant="default" size="sm">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        pause_circle
                      </span>
                      Disabled
                    </span>
                  </Badge>
                ) : isNoAuth ? (
                  <Badge variant="success" size="sm" dot>Ready</Badge>
                ) : (
                  <>
                    {getStatusDisplay(connected, error, errorCode)}
                    {errorTime && (
                      <span className="text-text-muted">{errorTime}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stats.total > 0 && (
              <div
                className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(!allDisabled ? false : true);
                }}
              >
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  onChange={() => {}}
                  title={allDisabled ? "Enable provider" : "Disable provider"}
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

ProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    textIcon: PropTypes.string,
  }).isRequired,
  stats: PropTypes.shape({
    connected: PropTypes.number,
    error: PropTypes.number,
    errorCode: PropTypes.string,
    errorTime: PropTypes.string,
  }).isRequired,
  authType: PropTypes.string,
  onToggle: PropTypes.func,
};

function ApiKeyProviderCard({
  providerId,
  provider,
  stats,
  authType,
  onToggle,
}) {
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isCompatible = providerId.startsWith(OPENAI_COMPATIBLE_PREFIX);
  const isAnthropicCompatible = providerId.startsWith(
    ANTHROPIC_COMPATIBLE_PREFIX,
  );

  const dotColors = {
    free: "bg-green-500",
    oauth: "bg-blue-500",
    apikey: "bg-amber-500",
    compatible: "bg-orange-500",
  };
  const dotLabels = {
    free: "Free",
    oauth: "OAuth",
    apikey: "API Key",
    compatible: "Compatible",
  };

  const getIconPath = () => {
    if (isCompatible) {
      const fallbackIconPath = isAnthropicCompatible
        ? "/providers/anthropic-m.png"
        : provider.apiType === "responses"
          ? "/providers/oai-r.png"
          : "/providers/oai-cc.png";
      return getProviderIconPathFromConfig(provider, fallbackIconPath);
    }
    return getProviderIconPath(provider.id);
  };

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group min-w-0">
      <Card
        padding="xs"
        className={`h-full hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${allDisabled ? "opacity-50" : ""}`}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="size-8 shrink-0 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `${provider.color?.length > 7 ? provider.color : provider.color + "15"}`,
              }}
            >
              <ProviderIcon
                src={getProviderIconSources(provider, getIconPath())}
                alt={provider.name}
                size={30}
                className="object-contain rounded-lg max-w-[30px] max-h-[30px]"
                fallbackText={
                  provider.textIcon || provider.id.slice(0, 2).toUpperCase()
                }
                fallbackColor={provider.color}
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{provider.name}</h3>
              <div className="flex min-w-0 items-center gap-1.5 text-xs flex-wrap">
                {allDisabled ? (
                  <Badge variant="default" size="sm">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        pause_circle
                      </span>
                      Disabled
                    </span>
                  </Badge>
                ) : (
                  <>
                    {getStatusDisplay(connected, error, errorCode)}
                    {isCompatible && (
                      <Badge variant="default" size="sm">
                        {provider.apiType === "responses"
                          ? "Responses"
                          : "Chat"}
                      </Badge>
                    )}
                    {isAnthropicCompatible && (
                      <Badge variant="default" size="sm">
                        Messages
                      </Badge>
                    )}
                    {errorTime && (
                      <span className="text-text-muted">{errorTime}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stats.total > 0 && (
              <div
                className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(!allDisabled ? false : true);
                }}
              >
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  onChange={() => {}}
                  title={allDisabled ? "Enable provider" : "Disable provider"}
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

ApiKeyProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    textIcon: PropTypes.string,
    apiType: PropTypes.string,
  }).isRequired,
  stats: PropTypes.shape({
    connected: PropTypes.number,
    error: PropTypes.number,
    errorCode: PropTypes.string,
    errorTime: PropTypes.string,
  }).isRequired,
  authType: PropTypes.string,
  onToggle: PropTypes.func,
};

function AddOpenAICompatibleModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: "",
    prefix: "",
    apiType: "chat",
    baseUrl: "https://api.openai.com/v1",
  });
  const [submitting, setSubmitting] = useState(false);
  const [checkKey, setCheckKey] = useState("");
  const [checkModelId, setCheckModelId] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const apiTypeOptions = [
    { value: "chat", label: "Chat Completions" },
    { value: "responses", label: "Responses API" },
  ];

  useEffect(() => {
    const defaultBaseUrl = "https://api.openai.com/v1";
    setFormData((prev) => ({ ...prev, baseUrl: defaultBaseUrl }));
  }, [formData.apiType]);

  const handleSubmit = async () => {
    if (
      !formData.name.trim() ||
      !formData.prefix.trim() ||
      !formData.baseUrl.trim()
    )
      return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/provider-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          prefix: formData.prefix,
          apiType: formData.apiType,
          baseUrl: formData.baseUrl,
          type: "openai-compatible",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data.node);
        setFormData({
          name: "",
          prefix: "",
          apiType: "chat",
          baseUrl: "https://api.openai.com/v1",
        });
        setCheckKey("");
        setValidationResult(null);
      }
    } catch (error) {
      console.log("Error creating OpenAI Compatible node:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          apiKey: checkKey,
          type: "openai-compatible",
          modelId: checkModelId.trim() || undefined,
        }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch {
      setValidationResult({ valid: false, error: "Network error" });
    } finally {
      setValidating(false);
    }
  };

  // Helper to render validation result
  const renderValidationResult = () => {
    if (!validationResult) return null;
    const { valid, error, method } = validationResult;

    if (valid) {
      return (
        <>
          <Badge variant="success">Valid</Badge>
          {method === "chat" && (
            <span className="text-sm text-text-muted">
              (via inference test)
            </span>
          )}
        </>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="error">Invalid</Badge>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} title="Add OpenAI Compatible" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="OpenAI Compatible (Prod)"
          hint="Required. A friendly label for this node."
        />
        <Input
          label="Prefix"
          value={formData.prefix}
          onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
          placeholder="oc-prod"
          hint="Required. Used as the provider prefix for model IDs."
        />
        <Select
          label="API Type"
          options={apiTypeOptions}
          value={formData.apiType}
          onChange={(e) =>
            setFormData({ ...formData, apiType: e.target.value })
          }
        />
        <Input
          label="Base URL"
          value={formData.baseUrl}
          onChange={(e) =>
            setFormData({ ...formData, baseUrl: e.target.value })
          }
          placeholder="https://api.openai.com/v1"
          hint="Use the base URL (ending in /v1) for your OpenAI-compatible API."
        />
        <Input
          label="API Key (for Check)"
          type="password"
          value={checkKey}
          onChange={(e) => setCheckKey(e.target.value)}
        />
        <Input
          label="Model ID (optional)"
          value={checkModelId}
          onChange={(e) => setCheckModelId(e.target.value)}
          placeholder="e.g. gpt-4, claude-3-opus"
          hint="If provider lacks /models endpoint, enter a model ID to validate via chat/completions instead."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={handleValidate}
            disabled={!checkKey || validating || !formData.baseUrl.trim()}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            {validating ? "Checking..." : "Check"}
          </Button>
          {renderValidationResult()}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleSubmit}
            fullWidth
            disabled={
              !formData.name.trim() ||
              !formData.prefix.trim() ||
              !formData.baseUrl.trim() ||
              submitting
            }
          >
            {submitting ? "Creating..." : "Create"}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

AddOpenAICompatibleModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
};

function AddAnthropicCompatibleModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: "",
    prefix: "",
    baseUrl: "https://api.anthropic.com/v1",
  });
  const [submitting, setSubmitting] = useState(false);
  const [checkKey, setCheckKey] = useState("");
  const [checkModelId, setCheckModelId] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null); // { valid, error, method }

  useEffect(() => {
    if (isOpen) {
      setValidationResult(null);
      setCheckKey("");
      setCheckModelId("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (
      !formData.name.trim() ||
      !formData.prefix.trim() ||
      !formData.baseUrl.trim()
    )
      return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/provider-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          prefix: formData.prefix,
          baseUrl: formData.baseUrl,
          type: "anthropic-compatible",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data.node);
        setFormData({
          name: "",
          prefix: "",
          baseUrl: "https://api.anthropic.com/v1",
        });
        setCheckKey("");
        setValidationResult(null);
      }
    } catch (error) {
      console.log("Error creating Anthropic Compatible node:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          apiKey: checkKey,
          type: "anthropic-compatible",
          modelId: checkModelId.trim() || undefined,
        }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch {
      setValidationResult({ valid: false, error: "Network error" });
    } finally {
      setValidating(false);
    }
  };

  // Helper to render validation result
  const renderValidationResult = () => {
    if (!validationResult) return null;
    const { valid, error, method } = validationResult;

    if (valid) {
      return (
        <>
          <Badge variant="success">Valid</Badge>
          {method === "chat" && (
            <span className="text-sm text-text-muted">
              (via inference test)
            </span>
          )}
        </>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="error">Invalid</Badge>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} title="Add Anthropic Compatible" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Anthropic Compatible (Prod)"
          hint="Required. A friendly label for this node."
        />
        <Input
          label="Prefix"
          value={formData.prefix}
          onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
          placeholder="ac-prod"
          hint="Required. Used as the provider prefix for model IDs."
        />
        <Input
          label="Base URL"
          value={formData.baseUrl}
          onChange={(e) =>
            setFormData({ ...formData, baseUrl: e.target.value })
          }
          placeholder="https://api.anthropic.com/v1"
          hint="Use the base URL (ending in /v1) for your Anthropic-compatible API. The system will append /messages."
        />
        <Input
          label="API Key (for Check)"
          type="password"
          value={checkKey}
          onChange={(e) => setCheckKey(e.target.value)}
        />
        <Input
          label="Model ID (optional)"
          value={checkModelId}
          onChange={(e) => setCheckModelId(e.target.value)}
          placeholder="e.g. claude-3-opus"
          hint="If provider lacks /models endpoint, enter a model ID to validate via chat/completions instead."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={handleValidate}
            disabled={!checkKey || validating || !formData.baseUrl.trim()}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            {validating ? "Checking..." : "Check"}
          </Button>
          {renderValidationResult()}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleSubmit}
            fullWidth
            disabled={
              !formData.name.trim() ||
              !formData.prefix.trim() ||
              !formData.baseUrl.trim() ||
              submitting
            }
          >
            {submitting ? "Creating..." : "Create"}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

AddAnthropicCompatibleModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
};

function ProviderTestResultsView({ results }) {
  if (results.error && !results.results) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-red-500 text-[32px] mb-2 block">
          error
        </span>
        <p className="text-sm text-red-400">{results.error}</p>
      </div>
    );
  }

  const { summary, mode } = results;
  const items = results.results || [];
  const modeLabel =
    {
      oauth: "OAuth",
      free: "Free",
      apikey: "API Key",
      provider: "Provider",
      all: "All",
    }[mode] || mode;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {summary && (
        <div className="flex flex-wrap items-center gap-2 text-xs mb-1 sm:gap-3">
          <span className="text-text-muted">{modeLabel} Test</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
            {summary.passed} passed
          </span>
          {summary.failed > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
              {summary.failed} failed
            </span>
          )}
          <span className="text-text-muted sm:ml-auto">
            {summary.total} tested
          </span>
        </div>
      )}
      {items.map((r, i) => (
        <div
          key={r.connectionId || i}
          className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2 text-xs dark:bg-white/[0.03] sm:flex-nowrap"
        >
          <span
            className={`material-symbols-outlined text-[16px] ${r.valid ? "text-emerald-500" : "text-red-500"}`}
          >
            {r.valid ? "check_circle" : "error"}
          </span>
          <div className="min-w-0 flex-[1_1_160px]">
            <span className="block truncate font-medium sm:inline">
              {r.connectionName}
            </span>
            <span className="block truncate text-text-muted sm:ml-1.5 sm:inline">
              ({r.provider})
            </span>
          </div>
          {r.latencyMs !== undefined && (
            <span className="shrink-0 text-text-muted font-mono tabular-nums">
              {r.latencyMs}ms
            </span>
          )}
          <span
            className={`shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              r.valid
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {r.valid ? "OK" : r.diagnosis?.type || "ERROR"}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-center py-4 text-text-muted text-sm">
          No active connections found for this group.
        </div>
      )}
    </div>
  );
}

ProviderTestResultsView.propTypes = {
  results: PropTypes.shape({
    mode: PropTypes.string,
    results: PropTypes.array,
    summary: PropTypes.shape({
      total: PropTypes.number,
      passed: PropTypes.number,
      failed: PropTypes.number,
    }),
    error: PropTypes.string,
  }).isRequired,
};

