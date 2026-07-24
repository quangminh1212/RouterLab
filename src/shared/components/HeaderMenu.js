"use client";

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { useTheme } from "@/shared/hooks/useTheme";
import { ConfirmModal } from "./Modal";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { downloadCliSetupScript } from "@/lib/cliToolBat";
import LanguageSwitcher from "./LanguageSwitcher";
import RamConfigModal from "./RamConfigModal";

const LOCALE_INFO = {
  "en": { name: "English", flag: "🇺🇸" },
  "vi": { name: "Tiếng Việt", flag: "🇻🇳" },
  "zh-CN": { name: "简体中文", flag: "🇨🇳" },
  "zh-TW": { name: "繁體中文", flag: "🇹🇼" },
  "ja": { name: "日本語", flag: "🇯🇵" },
  "pt-BR": { name: "Português (BR)", flag: "🇧🇷" },
  "pt-PT": { name: "Português (PT)", flag: "🇵🇹" },
  "ko": { name: "한국어", flag: "🇰🇷" },
  "es": { name: "Español", flag: "🇪🇸" },
  "de": { name: "Deutsch", flag: "🇩🇪" },
  "fr": { name: "Français", flag: "🇫🇷" },
  "he": { name: "עברית", flag: "🇮🇱" },
  "ar": { name: "العربية", flag: "🇸🇦" },
  "ru": { name: "Русский", flag: "🇷🇺" },
  "pl": { name: "Polski", flag: "🇵🇱" },
  "cs": { name: "Čeština", flag: "🇨🇿" },
  "nl": { name: "Nederlands", flag: "🇳🇱" },
  "tr": { name: "Türkçe", flag: "🇹🇷" },
  "uk": { name: "Українська", flag: "🇺🇦" },
  "tl": { name: "Tagalog", flag: "🇵🇭" },
  "id": { name: "Indonesia", flag: "🇮🇩" },
  "th": { name: "ไทย", flag: "🇹🇭" },
  "hi": { name: "हिन्दी", flag: "🇮🇳" },
  "bn": { name: "বাংলা", flag: "🇧🇩" },
  "ur": { name: "اردو", flag: "🇵🇰" },
  "ro": { name: "Română", flag: "🇷🇴" },
  "sv": { name: "Svenska", flag: "🇸🇪" },
  "it": { name: "Italiano", flag: "🇮🇹" },
  "el": { name: "Ελληνικά", flag: "🇬🇷" },
  "hu": { name: "Magyar", flag: "🇭🇺" },
  "fi": { name: "Suomi", flag: "🇫🇮" },
  "da": { name: "Dansk", flag: "🇩🇰" },
  "no": { name: "Norsk", flag: "🇳🇴" },
};

function getLocaleFromCookie() {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : "en";
  return normalizeLocale(value);
}

function getActiveApiKey(keys = []) {
  const active = keys.find((k) => k?.isActive !== false && typeof k?.key === "string" && k.key.trim());
  return active?.key || "";
}

function MenuItem({ icon, label, onClick, trailing, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-text-main hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      <span className={`material-symbols-outlined text-[20px] ${danger ? "" : "text-text-muted"}`}>
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {trailing && <span className="text-base">{trailing}</span>}
    </button>
  );
}

MenuItem.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  trailing: PropTypes.node,
  danger: PropTypes.bool,
};

function UpdateProgress({ status, latestVersion, installCmd }) {
  const phase = status?.phase || "connecting";
  const done = status?.done === true;
  const success = status?.success === true;
  const attempt = status?.attempt || 0;
  const maxRetries = status?.maxRetries || 0;

  let statusText = "Connecting to updater...";
  if (!done && phase === "waitingForExit") statusText = "Waiting for app processes to exit...";
  if (!done && phase === "installing") statusText = attempt > 1
    ? `Installing v${latestVersion || "latest"} (attempt ${attempt}/${maxRetries})...`
    : `Installing v${latestVersion || "latest"} from npm...`;
  if (done && success) statusText = `Installed v${latestVersion || "latest"} successfully.`;
  if (done && !success) statusText = status?.error || "Installation failed.";

  return (
    <div className="text-center p-8 max-w-lg">
      <div className="flex items-center justify-center size-16 rounded-full bg-blue-500/20 text-blue-400 mx-auto mb-4">
        <span className={`material-symbols-outlined text-[32px] ${done ? "" : "animate-spin"}`}>
          {done && success ? "check_circle" : done && !success ? "error" : "progress_activity"}
        </span>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">
        {done && success ? "Update Completed" : done && !success ? "Update Failed" : "Updating RouterLab"}
      </h2>
      <p className="text-text-muted mb-4">{statusText}</p>
      {done && !success && (
        <div className="rounded-lg bg-black/40 border border-white/10 p-3 mb-4">
          <p className="text-xs text-white/60 mb-2">Run manually:</p>
          <code className="text-xs text-amber-400">{installCmd}</code>
        </div>
      )}
      {done && (
        <button
          onClick={() => globalThis.location.reload()}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
        >
          Reload Page
        </button>
      )}
    </div>
  );
}

UpdateProgress.propTypes = {
  status: PropTypes.object,
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
};

export default function HeaderMenu({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [ramConfigOpen, setRamConfigOpen] = useState(false);
  const [locale, setLocale] = useState("en");
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const menuRef = useRef(null);

  const INSTALL_CMD = UPDATER_CONFIG.installCmd;
  const STATUS_URL = `http://localhost:${UPDATER_CONFIG.statusPort}/update/status`;

  useEffect(() => {
    setLocale(getLocaleFromCookie());
  }, [langOpen]);

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
      } catch {
        // ignore while updater starts
      }
    };

    tick();
    const id = setInterval(tick, UPDATER_CONFIG.statusPollIntervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [isUpdating, isDisconnected, STATUS_URL]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setDownloadOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setDownloadOpen(false);
  };

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
    } catch {
      setIsDisconnected(true);
    }
  };

  const handleDownloadSetup = async (os) => {
    try {
      const [statusRes, bootstrapRes] = await Promise.all([
        fetch("/api/tunnel/status", { cache: "no-store" }),
        fetch("/api/dashboard/bootstrap", { cache: "no-store" }),
      ]);

      if (!statusRes.ok || !bootstrapRes.ok) {
        alert("Failed to load tunnel/setup data.");
        return;
      }

      const statusData = await statusRes.json();
      const bootstrapData = await bootstrapRes.json();
      const endpointBase = statusData?.tunnel?.publicUrl || statusData?.tunnel?.tunnelUrl || statusData?.tailscale?.tunnelUrl;
      const apiKey = getActiveApiKey(bootstrapData?.keys || []);

      if (!endpointBase) {
        alert("No tunnel endpoint available. Please enable Tunnel or Tailscale first.");
        return;
      }

      if (!apiKey) {
        alert("No active API key found. Please create or activate an API key first.");
        return;
      }

      const endpoint = `${endpointBase.replace(/\/+$/, "")}/v1`;
      const filename = os === "windows" ? "setup-xlabrouter-cli.bat" : "setup-xlabrouter-cli.sh";

      downloadCliSetupScript({
        endpoint,
        apiKey,
        os,
        installCmd: INSTALL_CMD,
        filename,
      });
    } catch {
      alert("Failed to generate setup script.");
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const res = await fetch("/api/debug/logs-download", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to download logs");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename=([^;]+)/i);
      anchor.href = url;
      anchor.download = filenameMatch?.[1]?.replace(/"/g, "") || `logs-bundle-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      close();
    } catch {
      alert("Failed to download logs.");
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => {
            setIsOpen((v) => {
              const next = !v;
              if (!next) setDownloadOpen(false);
              return next;
            });
          }}
          className="flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          title="Menu"
        >
          <span className="material-symbols-outlined">grid_view</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-60 bg-surface border border-black/10 dark:border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden py-1">

            <MenuItem
              icon="language"
              label={LOCALE_INFO[locale]?.name || locale}
              trailing={LOCALE_INFO[locale]?.flag || "🌐"}
              onClick={() => { close(); setLangOpen(true); }}
            />
            <MenuItem
              icon={isDark ? "light_mode" : "dark_mode"}
              label="Theme"
              onClick={() => { toggleTheme(); close(); }}
            />
            <MenuItem
              icon="memory"
              label="RAM"
              onClick={() => { close(); setRamConfigOpen(true); }}
            />

            {updateInfo && (
              <MenuItem
                icon="system_update"
                label={`Update v${updateInfo.latestVersion}`}
                onClick={() => { close(); setShowUpdateModal(true); }}
              />
            )}
            <MenuItem
              icon="download"
              label="Download Setup"
              onClick={() => setDownloadOpen((v) => !v)}
            />
            <MenuItem
              icon="bug_report"
              label="Download Logs"
              onClick={handleDownloadLogs}
            />
            {downloadOpen && (
              <div className="px-2 pb-2">
                <button
                  onClick={() => { close(); handleDownloadSetup("windows"); }}
                  className="flex w-full rounded-lg px-3 py-2 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="flex-1 text-left">Windows (.bat)</span>
                </button>
                <button
                  onClick={() => { close(); handleDownloadSetup("unix"); }}
                  className="flex w-full rounded-lg px-3 py-2 text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="flex-1 text-left">macOS / Linux (.sh)</span>
                </button>
              </div>
            )}
            <MenuItem
              icon="logout"
              label="Logout"
              danger
              onClick={() => { close(); onLogout(); }}
            />
          </div>
        )}
      </div>

      <LanguageSwitcher hideTrigger isOpen={langOpen} onClose={() => setLangOpen(false)} />
      <RamConfigModal isOpen={ramConfigOpen} onClose={() => setRamConfigOpen(false)} />

      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Update RouterLab"
        message={`This will close RouterLab and install v${updateInfo?.latestVersion || ""} in a separate window. Continue?`}
        confirmText="Update"
        cancelText="Cancel"
        variant="primary"
        loading={isUpdating}
      />

      {isDisconnected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          {isUpdating ? (
            <UpdateProgress
              status={updateStatus}
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
            />
          ) : (
            <div className="text-center p-8">
              <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Server Disconnected</h2>
              <p className="text-text-muted mb-6">The proxy server has been stopped.</p>
              <button
                onClick={() => globalThis.location.reload()}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                Reload Page
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

HeaderMenu.propTypes = {
  onLogout: PropTypes.func.isRequired,
};
