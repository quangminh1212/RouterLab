"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS, getProviderIconPath } from "@/shared/constants/providers";
import { translate } from "@/i18n/runtime";
import { fetchWithTimeout } from "@/shared/utils/fetchWithTimeout";

const HeaderMenu = dynamic(() => import("@/shared/components/HeaderMenu"), {
  ssr: false,
});

const getPageInfo = (pathname) => {
  if (!pathname) return { title: "", description: "", breadcrumbs: [] };

  // Media provider detail: /dashboard/media-providers/[kind]/[id]
  const mediaDetailMatch = pathname.match(/\/media-providers\/([^/]+)\/([^/]+)$/);
  if (mediaDetailMatch) {
    const kindId = mediaDetailMatch[1];
    const providerId = mediaDetailMatch[2];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    const provider = AI_PROVIDERS[providerId];
    return {
      title: provider?.name || providerId,
      description: "",
      breadcrumbs: [
        { label: "Media Providers", href: `/dashboard/media-providers/${kindId}` },
        { label: kindConfig?.label || kindId, href: `/dashboard/media-providers/${kindId}` },
        { label: provider?.name || providerId, image: getProviderIconPath(providerId) },
      ],
    };
  }

  // Media provider kind: /dashboard/media-providers/[kind]
  const mediaKindMatch = pathname.match(/\/media-providers\/([^/]+)$/);
  if (mediaKindMatch) {
    const kindId = mediaKindMatch[1];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    return {
      title: kindConfig?.label || kindId,
      description: `Manage your ${kindConfig?.label || kindId} providers`,
      icon: kindConfig?.icon || "perm_media",
      breadcrumbs: [],
    };
  }

  // Provider detail page: /dashboard/providers/[id]
  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const providerId = providerMatch[1];
    const providerInfo =
      OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId];
    if (providerInfo) {
      return {
        title: providerInfo.name,
        description: "",
        breadcrumbs: [
          { label: "Providers", href: "/dashboard/providers" },
          {
            label: providerInfo.name,
            image: getProviderIconPath(providerInfo.id),
          },
        ],
      };
    }
  }

  if (pathname.includes("/providers") && !pathname.includes("/media-providers"))
    return {
      title: "Providers",
      description: "Manage your AI provider connections",
      icon: "dns",
      breadcrumbs: [],
    };
  if (pathname.includes("/combos"))
    return {
      title: "Combos",
      description: "Model combos with fallback",
      icon: "layers",
      breadcrumbs: [],
    };
  if (pathname.includes("/usage"))
    return {
      title: "Usage & Analytics",
      description:
        "Monitor your API usage, token consumption, and request logs",
      icon: "bar_chart",
      breadcrumbs: [],
    };
  if (pathname.includes("/quota"))
    return {
      title: "Quota Tracker",
      description: "Track and manage your API quota limits",
      icon: "data_usage",
      breadcrumbs: [],
    };
  if (pathname.includes("/mitm"))
    return {
      title: "MITM Proxy",
      description: "Intercept CLI tool traffic and route through XLab Router",
      icon: "security",
      breadcrumbs: [],
    };
  if (pathname.includes("/cli-tools"))
    return {
      title: "CLI Tools",
      description: "Configure CLI tools",
      icon: "terminal",
      breadcrumbs: [],
    };
  if (pathname.includes("/proxy-pools"))
    return {
      title: "Proxy Pools",
      description: "Manage your proxy pool configurations",
      icon: "lan",
      breadcrumbs: [],
    };
  if (pathname.includes("/endpoint"))
    return {
      title: "Endpoint",
      description: "API endpoint configuration",
      icon: "api",
      breadcrumbs: [],
    };
  if (pathname.includes("/profile"))
    return {
      title: "Settings",
      description: "Manage your preferences",
      icon: "settings",
      breadcrumbs: [],
    };
  if (pathname.includes("/translator"))
    return {
      title: "Translator",
      description: "Debug translation flow between formats",
      icon: "translate",
      breadcrumbs: [],
    };
  if (pathname.includes("/console-log"))
    return {
      title: "Console Log",
      description: "Live server console output",
      icon: "monitor",
      breadcrumbs: [],
    };
  if (pathname === "/dashboard")
    return {
      title: "Endpoint",
      description: "API endpoint configuration",
      icon: "api",
      breadcrumbs: [],
    };
  return { title: "", description: "", breadcrumbs: [] };
};

const HEADER_METRICS_TIMEOUT_MS = 1500;
const HEADER_METRICS_CACHE_KEY = "__xlabrouterHeaderMetrics";

function formatMemoryGb(bytes) {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(0, bytes / (1024 ** 2)).toFixed(0)} MB`;
}

export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const router = useRouter();
  const [systemMetrics, setSystemMetrics] = useState(null);
  const headerSearchVisible = useHeaderSearchStore((state) => state.visible);
  const headerSearchQuery = useHeaderSearchStore((state) => state.query);
  const headerSearchPlaceholder = useHeaderSearchStore((state) => state.placeholder);
  const setHeaderSearchQuery = useHeaderSearchStore((state) => state.setQuery);

  // Memoize page info to prevent unnecessary recalculations
  const pageInfo = useMemo(() => getPageInfo(pathname), [pathname]);
  const { title, description, icon, breadcrumbs } = pageInfo;

  useEffect(() => {
    let mounted = true;
    let interval = null;
    let idleId = null;
    let timeoutId = null;

    const fetchMetrics = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      // Check cache first
      const cached = globalThis[HEADER_METRICS_CACHE_KEY];
      if (cached?.data && Date.now() - cached.timestamp < 4000) {
        if (mounted) setSystemMetrics(cached.data);
        return;
      }

      // Deduplicate concurrent requests
      if (cached?.promise) {
        try {
          const data = await cached.promise;
          if (mounted) setSystemMetrics(data);
        } catch {
          // ignore
        }
        return;
      }

      try {
        const promise = fetchWithTimeout("/api/system/metrics", { cache: "no-store" }, HEADER_METRICS_TIMEOUT_MS, "Loading system metrics timed out")
          .then(response => {
            if (!response.ok) throw new Error("Metrics fetch failed");
            return response.json();
          })
          .then(data => {
            globalThis[HEADER_METRICS_CACHE_KEY] = { data, timestamp: Date.now() };
            return data;
          });

        globalThis[HEADER_METRICS_CACHE_KEY] = { promise };
        const data = await promise;
        if (mounted) setSystemMetrics(data);
      } catch {
        // ignore metrics errors in header
        if (globalThis[HEADER_METRICS_CACHE_KEY]?.promise) {
          delete globalThis[HEADER_METRICS_CACHE_KEY];
        }
      }
    };

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(fetchMetrics, 5000);
    };

    const stopPolling = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMetrics();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const startMetricsWork = () => {
      fetchMetrics();
      startPolling();
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(startMetricsWork, { timeout: 4000 });
    } else {
      timeoutId = setTimeout(startMetricsWork, 2500);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      stopPolling();
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function" && idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-black/5 dark:border-white/5 bg-bg/80 backdrop-blur-xl z-10 sticky top-0">
      {/* Mobile menu button */}
      <div className="flex items-center gap-3 lg:hidden">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="text-text-main hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
      </div>

      {/* Page title with breadcrumbs - desktop */}
      <div className="hidden lg:flex flex-col">
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-2">
            {breadcrumbs.map((crumb, index) => (
              <div
                key={`${crumb.label}-${crumb.href || "current"}`}
                className="flex items-center gap-2"
              >
                {index > 0 && (
                  <span className="material-symbols-outlined text-text-muted text-base">
                    chevron_right
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-text-muted hover:text-primary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    {crumb.image && (
                      <ProviderIcon
                        src={crumb.image}
                        alt={crumb.label}
                        size={28}
                        className="object-contain rounded max-w-[28px] max-h-[28px]"
                        fallbackText={crumb.label.slice(0, 2).toUpperCase()}
                      />
                    )}
                    <h1 className="text-2xl font-semibold text-text-main tracking-tight">
                      {translate(crumb.label)}
                    </h1>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : title ? (
          <div>
            <div className="flex items-center gap-2">
              {icon && (
                <span className="material-symbols-outlined text-primary text-2xl">
                  {icon}
                </span>
              )}
              <h1 className="text-2xl font-semibold tracking-tight">
                {translate(title)}
              </h1>
            </div>
            {description && (
              <p className="text-sm text-text-muted">
                {translate(description)}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Right actions - consolidated into dropdown menu */}
      <div className="flex items-center gap-2 ml-auto">
        {headerSearchVisible && (
          <div className="relative hidden sm:block w-[180px] lg:w-[240px]">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[16px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={headerSearchQuery}
              onChange={(event) => setHeaderSearchQuery(event.target.value)}
              placeholder={headerSearchPlaceholder || "Search..."}
              className="h-8 w-full rounded-lg border border-border bg-surface/70 pl-7 pr-7 text-sm text-text-main focus:outline-none focus:border-primary/50 transition-colors"
            />
            {headerSearchQuery && (
              <button
                type="button"
                onClick={() => setHeaderSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-text-main"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        )}
        {systemMetrics && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="group inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 text-emerald-600 shadow-sm shadow-emerald-500/5 transition-colors dark:text-emerald-300 dark:border-emerald-400/25 dark:bg-emerald-400/10">
              <span className="h-1.5 w-1.5 rounded-sm bg-emerald-500 shadow-[0_0_7px_rgba(16,185,129,0.75)]" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-emerald-700/70 dark:text-emerald-200/70">CPU</span>
              <span className="tabular-nums text-text-main dark:text-white">
                {typeof systemMetrics.cpuPercent === "number" ? `${systemMetrics.cpuPercent.toFixed(0)}%` : "--"}
              </span>
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 text-sky-600 shadow-sm shadow-sky-500/5 transition-colors dark:text-sky-300 dark:border-sky-400/25 dark:bg-sky-400/10" title={`XLab Router: ${formatMemoryGb(systemMetrics.usedMemoryBytes || 0)} / Tổng RAM: ${formatMemoryGb(systemMetrics.totalMemoryBytes || 0)}`}>
              <span className="material-symbols-outlined text-[14px] leading-none">memory</span>
              <span className="text-[9px] uppercase tracking-[0.12em] text-sky-700/70 dark:text-sky-200/70">RAM</span>
              <span className="tabular-nums text-text-main dark:text-white">
                {formatMemoryGb(systemMetrics.usedMemoryBytes || 0)} / {formatMemoryGb(systemMetrics.totalMemoryBytes || 0)}
              </span>
            </span>
            {typeof systemMetrics.diskUsedBytes === "number" && typeof systemMetrics.diskTotalBytes === "number" && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 text-amber-600 shadow-sm shadow-amber-500/5 transition-colors dark:text-amber-300 dark:border-amber-400/25 dark:bg-amber-400/10" title={`SSD đã dùng: ${formatMemoryGb(systemMetrics.diskUsedBytes)} / Tổng: ${formatMemoryGb(systemMetrics.diskTotalBytes)}`}>
                <span className="material-symbols-outlined text-[14px] leading-none">hard_drive</span>
                <span className="text-[9px] uppercase tracking-[0.12em] text-amber-700/70 dark:text-amber-200/70">SSD</span>
                <span className="tabular-nums text-text-main dark:text-white">
                  {formatMemoryGb(systemMetrics.diskUsedBytes)} / {formatMemoryGb(systemMetrics.diskTotalBytes)}
                </span>
              </span>
            )}
          </div>
        )}
        <HeaderMenu onLogout={handleLogout} />
      </div>
    </header>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
};
