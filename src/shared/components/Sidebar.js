"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Button from "./Button";
import { ConfirmModal } from "./Modal";
import { fetchWithTimeout } from "@/shared/utils/fetchWithTimeout";

// const VISIBLE_MEDIA_KINDS = ["embedding", "image", "imageToText", "tts", "stt", "webSearch", "webFetch", "video", "music"];
const VISIBLE_MEDIA_KINDS = ["embedding", "image", "tts", "stt"];
const MEDIA_NAV_ITEMS = [
  { id: "embedding", label: "Embedding", icon: "data_array" },
  { id: "image", label: "Tạo ảnh", icon: "brush" },
  { id: "tts", label: "Đọc văn bản", icon: "record_voice_over" },
  { id: "stt", label: "Nhận giọng nói", icon: "mic" },
];
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };

const coreItems = [
  { href: "/dashboard/basic-chat", label: "Chat", icon: "chat" },
  { href: "/dashboard/endpoint", label: "Điểm cuối", icon: "api" },
  { href: "/dashboard/providers", label: "Nhà cung cấp", icon: "dns" },
  { href: "/dashboard/combos", label: "Kết hợp", icon: "layers" },
  { href: "/dashboard/usage", label: "Thống kê", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Hạn mức", icon: "data_usage" },
];

const aiItems = [
  { href: "/dashboard/token-saver", label: "Tiết kiệm token", icon: "compress" },
  { href: "/dashboard/rules", label: "Luật AI", icon: "gavel" },
  { href: "/dashboard/ai-integrations", label: "Nguồn AI", icon: "hub" },
  { href: "/dashboard/skills", label: "Thư viện skill", icon: "menu_book" },
];

const debugItems = [
  { href: "/dashboard/console-log", label: "Nhật ký Console", icon: "terminal" },
  { href: "/dashboard/translator", label: "Dịch thuật", icon: "translate" },
];

const systemItems = [
  { href: "/dashboard/mitm", label: "MITM", icon: "security" },
  { href: "/dashboard/cli-tools", label: "Công cụ CLI", icon: "terminal" },
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/settings/pricing", label: "Bảng giá", icon: "payments" },
];

const SIDEBAR_BACKGROUND_FETCH_TIMEOUT_MS = 2500;

const POWER_UP_ITEMS = [
  { href: "/dashboard/mcp-servers", label: "MCP Servers", icon: "dns" },
  { href: "/dashboard/ai-memory", label: "Bộ nhớ AI", icon: "memory" },
  { href: "/dashboard/ai-plugins", label: "Plugin", icon: "extension" },
  { href: "/dashboard/ai-skills", label: "Kỹ năng AI", icon: "psychology" },
];

export default function Sidebar({ onClose, initialEnableTranslator = false, initialUpdateInfo = null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [powerUpOpen, setPowerUpOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({ core: false, ai: false, system: false });
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(initialUpdateInfo);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [enableTranslator, setEnableTranslator] = useState(initialEnableTranslator);
  const { copied, copy } = useCopyToClipboard(2000);

  const INSTALL_CMD = UPDATER_CONFIG.installCmd;
  const STATUS_URL = `http://localhost:${UPDATER_CONFIG.statusPort}/update/status`;

  useEffect(() => {
    const saved = window.localStorage.getItem("xlabrouter-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const nextValue = !value;
      window.localStorage.setItem("xlabrouter-sidebar-collapsed", String(nextValue));
      return nextValue;
    });
  };

  const toggleSection = (key) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    let idleId = null;
    let timeoutId = null;
    const loadSidebarSettings = () => {
      fetchWithTimeout("/api/settings", { cache: "no-store" }, SIDEBAR_BACKGROUND_FETCH_TIMEOUT_MS, "Loading sidebar settings timed out")
        .then(res => res.json())
        .then(data => { if (data.enableTranslator) setEnableTranslator(true); })
        .catch(() => {});
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(loadSidebarSettings, { timeout: 6000 });
    } else {
      timeoutId = setTimeout(loadSidebarSettings, 4500);
    }

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function" && idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  // Defer slow network update checks so first dashboard paint is not delayed.
  useEffect(() => {
    const timer = setTimeout(() => {
      const cacheKey = "__xlabrouterVersionCheck";
      const cached = globalThis[cacheKey];

      if (cached?.data) {
        if (cached.data.hasUpdate) setUpdateInfo(cached.data);
        return;
      }

      if (cached?.promise) {
        cached.promise
          .then((data) => {
            if (data?.hasUpdate) setUpdateInfo(data);
          })
          .catch(() => {});
        return;
      }

      const promise = fetchWithTimeout("/api/version", { cache: "no-store" }, SIDEBAR_BACKGROUND_FETCH_TIMEOUT_MS, "Loading version timed out")
        .then(res => res.json())
        .then((data) => {
          globalThis[cacheKey] = { data };
          return data;
        });

      globalThis[cacheKey] = { promise };
      promise
        .then((data) => {
          if (data?.hasUpdate) setUpdateInfo(data);
        })
        .catch(() => {
          if (globalThis[cacheKey]?.promise === promise) delete globalThis[cacheKey];
        });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const isActive = (href) => {
    if (href === "/dashboard/endpoint") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    }
    return pathname.startsWith(href);
  };

  const isPowerUpActive = POWER_UP_ITEMS.some((item) => pathname.startsWith(item.href));
  const renderNavItem = (item) => (
    <Link
      key={item.href}
      href={item.href}
      prefetch={false}
      onClick={onClose}
      className={cn(
        collapsed ? "flex items-center justify-center px-2 py-2 rounded-lg transition-all group" : "flex items-center gap-3 px-4 py-2 rounded-lg transition-all group",
        isActive(item.href)
          ? "bg-primary/16 text-primary shadow-[inset_3px_0_0_rgba(24,120,120,0.75)]"
          : "text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
      )}
    >
      <span
        className={cn(
          "material-symbols-outlined text-[18px]",
          isActive(item.href) ? "fill-1 text-white" : "text-white/90 group-hover:text-white transition-colors"
        )}
      >
        {item.icon}
      </span>
      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
    </Link>
  );
  const renderSectionTitle = (label) => !collapsed && (
    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-primary/55 uppercase tracking-wider">
      {label}
    </p>
  );
  const renderCollapsibleHeader = (key, label) => !collapsed && (
    <button
      type="button"
      onClick={() => toggleSection(key)}
      className="w-full flex items-center justify-between px-4 pt-4 pb-2 text-xs font-semibold text-primary/55 uppercase tracking-wider hover:text-primary transition-colors"
      aria-expanded={sectionsOpen[key]}
    >
      <span>{label}</span>
      <span className="material-symbols-outlined text-[14px] transition-transform" style={{ transform: sectionsOpen[key] ? "rotate(0deg)" : "rotate(-90deg)" }}>
        expand_more
      </span>
    </button>
  );

  const handleUpdate = async () => {
    setIsUpdating(true);
    setShowUpdateModal(false);
    try {
      const res = await fetch("/api/version/update", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Update failed. Please run the install command manually.");
        setIsUpdating(false);
        return;
      }
      setIsDisconnected(true);
    } catch (e) {
      setIsDisconnected(true);
    }
  };

  // Poll updater status server while updating (Next server is dead, updater.js is alive)
  useEffect(() => {
    if (!isUpdating || !isDisconnected) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(STATUS_URL, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!stopped) setUpdateStatus(data);
        }
      } catch { /* updater not ready yet or finished */ }
    };
    tick();
    const id = setInterval(tick, UPDATER_CONFIG.statusPollIntervalMs);
    return () => { stopped = true; clearInterval(id); };
  }, [isUpdating, isDisconnected, STATUS_URL]);

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try {
      await fetch("/api/shutdown", { method: "POST" });
    } catch (e) {
      // Expected to fail as server shuts down; ignore error
    }
    setIsShuttingDown(false);
    setShowShutdownModal(false);
    setIsDisconnected(true);
  };

  return (
    <>
      <aside className={cn(
        "flex flex-col overflow-hidden border-r border-primary/15 bg-[#0F1D20] dark:bg-[#0F1D20] shadow-[inset_-1px_0_0_rgba(24,120,120,0.16)] transition-all duration-300 h-full",
        collapsed ? "w-16" : "w-72"
      )}>
        {/* Traffic lights */}
        <div className={cn("flex items-center gap-2 pt-5 pb-2", collapsed ? "justify-center px-3" : "px-6")}>
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          ) : (
            <>
          <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
              <button
                type="button"
                onClick={toggleCollapsed}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
            </>
          )}
        </div>

        {/* Logo */}
        <div className={cn("py-4 flex flex-col gap-2", collapsed ? "px-3" : "px-6")}>
          <Link href="/dashboard" prefetch={false} className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <div className="flex items-center justify-center size-9 rounded overflow-hidden">
              <img src="/topup.png" alt="XLab Router logo" loading="lazy" className="w-full h-full object-cover" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold tracking-tight text-text-main">
                  {APP_CONFIG.name}
                </h1>
                <span className="text-xs text-text-muted">v{APP_CONFIG.version}</span>
              </div>
            )}
          </Link>
          {updateInfo && !collapsed && (
            <div className="flex flex-col gap-1.5 rounded p-1 -m-1">
              <span className="text-xs font-semibold text-green-600 dark:text-amber-500">
                ✨ New version available: v{updateInfo.latestVersion}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Update now
                </button>
                <button
                  onClick={() => copy(INSTALL_CMD)}
                  title="Copy install command"
                  className="flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer min-w-0"
                >
                  <code className="block text-[10px] text-green-600/80 dark:text-amber-400/70 font-mono truncate">
                    {copied ? "✓ copied!" : INSTALL_CMD}
                  </code>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 min-h-0 py-2 space-y-1 overflow-y-auto custom-scrollbar", collapsed ? "px-2" : "px-4")}>
          {renderCollapsibleHeader("core", "CORE")}
          {(collapsed || sectionsOpen.core) && coreItems.map(renderNavItem)}
          {renderCollapsibleHeader("ai", "AI")}
          {(collapsed || sectionsOpen.ai) && aiItems.map(renderNavItem)}

          {/* Media + System sections */}
          <div className="mt-2">
            {renderSectionTitle("MEDIA")}

            {/* Media Providers accordion */}
            {!collapsed && (
              <>
            <button
              onClick={() => setMediaOpen((v) => !v)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all group",
                pathname.startsWith("/dashboard/media-providers")
                  ? "bg-primary/16 text-primary shadow-[inset_3px_0_0_rgba(24,120,120,0.75)]"
                  : "text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
              )}
            >
              <span className="material-symbols-outlined text-[18px] text-white/90 group-hover:text-white transition-colors">perm_media</span>
              <span className="text-sm font-medium flex-1 text-left">Media Providers</span>
              <span className="material-symbols-outlined text-[14px] transition-transform" style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                expand_more
              </span>
            </button>
            {mediaOpen && (
              <div className="pl-4">
                {MEDIA_NAV_ITEMS.filter((kind) => VISIBLE_MEDIA_KINDS.includes(kind.id)).map((kind) => (
                  <Link
                    key={kind.id}
                    href={`/dashboard/media-providers/${kind.id}`}
                    prefetch={false}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-1.5 rounded-lg transition-all group",
                      pathname.startsWith(`/dashboard/media-providers/${kind.id}`)
                        ? "bg-primary/16 text-primary shadow-[inset_3px_0_0_rgba(24,120,120,0.75)]"
                        : "text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px] text-white/90 group-hover:text-white transition-colors">{kind.icon}</span>
                    <span className="text-sm">{kind.label}</span>
                  </Link>
                ))}
                <Link
                  key={COMBINED_WEB_ITEM.id}
                  href={COMBINED_WEB_ITEM.href}
                  prefetch={false}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-1.5 rounded-lg transition-all group",
                    pathname.startsWith(COMBINED_WEB_ITEM.href)
                      ? "bg-primary/16 text-primary shadow-[inset_3px_0_0_rgba(24,120,120,0.75)]"
                      : "text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
                  )}
                >
                  <span className="material-symbols-outlined text-[16px] text-white/90 group-hover:text-white transition-colors">{COMBINED_WEB_ITEM.icon}</span>
                  <span className="text-sm">{COMBINED_WEB_ITEM.label}</span>
                </Link>
              </div>
            )}
              </>
            )}

            {/* Power Up accordion */}
            {!collapsed && (
              <>
            <button
              onClick={() => setPowerUpOpen((v) => !v)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all group",
                isPowerUpActive
                  ? "bg-primary/16 text-primary shadow-[inset_3px_0_0_rgba(24,120,120,0.75)]"
                  : "text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
              )}
            >
              <span className="material-symbols-outlined text-[18px] text-white/90 group-hover:text-white transition-colors">rocket_launch</span>
              <span className="text-sm font-medium flex-1 text-left">AI Nâng cao</span>
              <span className="material-symbols-outlined text-[14px] transition-transform" style={{ transform: powerUpOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                expand_more
              </span>
            </button>
            {powerUpOpen && (
              <div className="pl-3 space-y-0.5">
                {POWER_UP_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 transition-colors group",
                      pathname.startsWith(item.href)
                        ? "text-primary"
                        : "text-[#9BB4B6] hover:text-[#DFF5F3]"
                    )}
                  >
                    <span className="material-symbols-outlined text-[15px] text-white/90 group-hover:text-white transition-colors">{item.icon}</span>
                    <span className="text-[13px]">{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
              </>
            )}

            {renderCollapsibleHeader("system", "SYSTEM")}
            {(collapsed || sectionsOpen.system) && systemItems.map(renderNavItem)}

            {/* Debug items (inside System section, before Settings) */}
            {(collapsed || sectionsOpen.system) && debugItems.map((item) => {
              const show = item.href !== "/dashboard/translator" || enableTranslator;
              return show ? (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={onClose}
                  className={cn(
                    collapsed ? "flex items-center justify-center px-2 py-2 rounded-lg transition-all group" : "flex items-center gap-3 px-4 py-2 rounded-lg transition-all group",
                    isActive(item.href)
                      ? "bg-primary/16 text-primary shadow-[inset_3px_0_0_rgba(24,120,120,0.75)]"
                      : "text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined text-[18px]",
                      isActive(item.href) ? "fill-1 text-white" : "text-white/90 group-hover:text-white transition-colors"
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              ) : null;
            })}

            {/* Settings */}
            <Link
              href="/dashboard/profile"
              prefetch={false}
              onClick={onClose}
              className={cn(
                collapsed ? "flex items-center justify-center px-2 py-2 rounded-lg transition-all group" : "flex items-center gap-3 px-4 py-2 rounded-lg transition-all group",
                isActive("/dashboard/profile")
                  ? "bg-primary/16 text-primary shadow-[inset_3px_0_0_rgba(24,120,120,0.75)]"
                  : "text-[#9BB4B6] hover:bg-primary/8 hover:text-[#DFF5F3]"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[18px]",
                  isActive("/dashboard/profile") ? "fill-1 text-white" : "text-white/90 group-hover:text-white transition-colors"
                )}
              >
                settings
              </span>
              {!collapsed && <span className="text-sm font-medium">Cài đặt</span>}
            </Link>
          </div>
        </nav>

        {/* Footer section */}
        <div className={cn("border-t border-primary/15", collapsed ? "p-2" : "p-3")}>
          {/* Shutdown button */}
          <Button
            variant="outline"
            fullWidth
            icon="power_settings_new"
            onClick={() => setShowShutdownModal(true)}
            className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            {collapsed ? "" : "Tắt máy"}
          </Button>
        </div>
      </aside>

      {/* Shutdown Confirmation Modal */}
      <ConfirmModal
        isOpen={showShutdownModal}
        onClose={() => setShowShutdownModal(false)}
        onConfirm={handleShutdown}
        title="Tắt Proxy"
        message="Bạn có chắc muốn tắt proxy server không?"
        confirmText="Tắt"
        cancelText="Cancel"
        variant="danger"
        loading={isShuttingDown}
      />

      {/* Update Confirmation Modal */}
      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Update XLab Router"
        message={`This will close XLab Router and install v${updateInfo?.latestVersion || ""} in a separate window. Continue?`}
        confirmText="Update"
        cancelText="Cancel"
        variant="primary"
        loading={isUpdating}
      />

      {/* Disconnected Overlay */}
      {isDisconnected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          {isUpdating ? (
            <UpdateProgress
              status={updateStatus}
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopy={() => copy(INSTALL_CMD)}
            />
          ) : (
            <div className="text-center p-8">
              <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Server Disconnected</h2>
              <p className="text-text-muted mb-6">The proxy server has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
  initialEnableTranslator: PropTypes.bool,
  initialUpdateInfo: PropTypes.object,
};

function UpdateProgress({ status, latestVersion, installCmd, copied, onCopy }) {
  const phase = status?.phase || "connecting";
  const done = status?.done === true;
  const success = status?.success === true;
  const attempt = status?.attempt || 0;
  const maxRetries = status?.maxRetries || 0;
  const logTail = status?.logTail || [];
  const errorMsg = status?.error;

  const steps = [
    { key: "stopped", label: "Stopped XLab Router server", state: "done" },
    {
      key: "launched",
      label: "Launched background installer",
      state: status ? "done" : "active",
    },
    {
      key: "waiting",
      label: "Waiting for app processes to exit",
      state: phase === "waitingForExit" ? "active" :
        (status && phase !== "starting" ? "done" : "pending"),
    },
    {
      key: "installing",
      label: attempt > 1 ? `Installing v${latestVersion || "latest"} (attempt ${attempt}/${maxRetries})` : `Installing v${latestVersion || "latest"}`,
      state: done ? (success ? "done" : "error") : (phase === "installing" ? "active" : "pending"),
    },
    {
      key: "finished",
      label: done && success ? "Installed — ready to restart" : "Waiting to finish",
      state: done && success ? "done" : (done && !success ? "error" : "pending"),
    },
  ];

  return (
    <div className="w-full max-w-lg rounded-xl bg-neutral-900/95 border border-white/10 p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "flex items-center justify-center size-11 rounded-full",
          done && success ? "bg-green-500/20 text-green-400" :
          done && !success ? "bg-red-500/20 text-red-400" :
          "bg-blue-500/20 text-blue-400"
        )}>
          <span className={cn(
            "material-symbols-outlined text-[24px]",
            !done && "animate-spin"
          )}>
            {done && success ? "check_circle" : done && !success ? "error" : "progress_activity"}
          </span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {done && success ? "Update Completed" : done && !success ? "Update Failed" : "Updating XLab Router"}
          </h2>
          <p className="text-xs text-white/60">
            {done && success
              ? `Installed v${latestVersion || "latest"} successfully`
              : done && !success
                ? (errorMsg || "Installation failed")
                : `Installing v${latestVersion || "latest"} from npm...`}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <ul className="space-y-2 mb-4">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span className={cn(
              "material-symbols-outlined text-[18px] shrink-0",
              s.state === "done" && "text-green-400",
              s.state === "active" && "text-blue-400 animate-pulse",
              s.state === "error" && "text-red-400",
              s.state === "pending" && "text-white/30"
            )}>
              {s.state === "done" ? "check_circle" :
                s.state === "error" ? "cancel" :
                  s.state === "active" ? "radio_button_checked" : "radio_button_unchecked"}
            </span>
            <span className={cn(
              s.state === "pending" ? "text-white/40" : "text-white/90"
            )}>{s.label}</span>
          </li>
        ))}
      </ul>

      {/* Log tail */}
      {logTail.length > 0 && (
        <div className="rounded-md bg-black/50 border border-white/5 p-3 mb-4 max-h-40 overflow-auto">
          <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all">
            {logTail.join("\n")}
          </pre>
        </div>
      )}

      {/* Actions */}
      {done && success ? (
        <div className="space-y-2">
          <p className="text-sm text-white/80">
            Run <code className="px-1.5 py-0.5 rounded bg-white/10 text-green-400">xlabrouter</code> in your terminal to start the new version.
          </p>
          <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
            Reload Page
          </Button>
        </div>
      ) : done && !success ? (
        <div className="space-y-2">
          <p className="text-sm text-white/80">Run the install command manually:</p>
          <button
            onClick={onCopy}
            className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
          >
            <code className="text-xs font-mono text-amber-400">
              {copied ? "✓ copied!" : installCmd}
            </code>
          </button>
        </div>
      ) : (
        <p className="text-xs text-white/50 text-center">
          This may take 30-60 seconds. Please don't close this window.
        </p>
      )}
    </div>
  );
}

UpdateProgress.propTypes = {
  status: PropTypes.object,
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopy: PropTypes.func.isRequired,
};
