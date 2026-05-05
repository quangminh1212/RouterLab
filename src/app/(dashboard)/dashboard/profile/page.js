"use client";
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, Button, Toggle, Input } from "@/shared/components";
import { Skeleton } from "@/shared/components/Loading";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
const INITIAL_SECTION_LOADING = {
  security: true,
  routing: true,
  network: true,
  observability: true,
};
export default function ProfilePage() {
  const { theme, setTheme, isDark } = useTheme();
  const [settings, setSettings] = useState({ fallbackStrategy: "fill-first" });
  const [sectionLoading, setSectionLoading] = useState(INITIAL_SECTION_LOADING);
  const [settingsLoadError, setSettingsLoadError] = useState(false);
  const [passStatus, setPassStatus] = useState({ type: "", message: "" });
  const [passLoading, setPassLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState({ type: "", message: "" });
  const importFileRef = useRef(null);
  const [gistConfig, setGistConfig] = useState({ enabled: false, hasToken: false, gistId: "", htmlUrl: "", updatedAt: "", tokenSource: "", githubLogin: "" });
  const [gistLoading, setGistLoading] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({
    loading: true,
    configured: false,
    connected: false,
    email: "",
    backup: null,
    authSource: "none",
    expectedRedirectUri: "",
  });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [oauthSetupUrl, setOauthSetupUrl] = useState("");
  const [oauthSetupQrUrl, setOauthSetupQrUrl] = useState("");
  const [oauthSetupSecret, setOauthSetupSecret] = useState("");
  const [authenticatorCode, setAuthenticatorCode] = useState("");
  const [showAuthenticatorCheck, setShowAuthenticatorCheck] = useState(false);
  const [authenticatorCheckLoading, setAuthenticatorCheckLoading] = useState(false);
  const [backupCodeCount, setBackupCodeCount] = useState(0);
  const [backupCodes, setBackupCodes] = useState([]);
  const [proxyForm, setProxyForm] = useState({
    outboundProxyEnabled: false,
    outboundProxyUrl: "",
    outboundNoProxy: "",
  });
  const [proxyStatus, setProxyStatus] = useState({ type: "", message: "" });
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyTestLoading, setProxyTestLoading] = useState(false);
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        applySettings(data);
      })
      .catch((err) => {
        console.error("Failed to fetch settings:", err);
        setSectionLoading({
          security: false,
          routing: false,
          network: false,
          observability: false,
        });
        setSettingsLoadError(true);
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/auth/oauth-qr", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.url) setOauthSetupUrl(data.url);
        if (data?.secret) setOauthSetupSecret(data.secret);
        if (typeof data?.backupCodeCount === "number") setBackupCodeCount(data.backupCodeCount);
        else setOauthSetupUrl("");
      })
      .catch(() => setOauthSetupUrl(""));
  }, []);

  useEffect(() => {
    if (!oauthSetupUrl) return;
    QRCode.toDataURL(oauthSetupUrl, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then(setOauthSetupQrUrl)
      .catch(() => setPassStatus({ type: "error", message: "Failed to render Authenticator QR" }));
  }, [oauthSetupUrl]);

  useEffect(() => {
    fetch(`/api/auth/google/status?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setGoogleStatus({
        loading: false,
        configured: !!data?.configured,
        connected: !!data?.connected,
        email: data?.email || "",
        backup: data?.backup || null,
        authSource: data?.authSource || "none",
        expectedRedirectUri: data?.expectedRedirectUri || "",
      }))
      .catch(() => setGoogleStatus((prev) => ({ ...prev, loading: false })));
  }, []);
  useEffect(() => {
    fetch("/api/settings/gist-backup", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        setGistConfig(data);
      })
      .catch(() => {});
  }, []);
  const InlineSettingSkeleton = ({ wide = false }) => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className={cn("h-3 w-48", wide && "w-64 max-w-full")} />
      </div>
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  );
  const applySettings = (data) => {
    setSettings(data);
    setProxyForm({
      outboundProxyEnabled: data?.outboundProxyEnabled === true,
      outboundProxyUrl: data?.outboundProxyUrl || "",
      outboundNoProxy: data?.outboundNoProxy || "",
    });
    setSectionLoading({
      security: false,
      routing: false,
      network: false,
      observability: false,
    });
    setSettingsLoadError(false);
  };
  const patchSettings = async (body) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to update settings");
    }
    setSettings((prev) => ({ ...prev, ...data }));
    return data;
  };
  const updateOutboundProxy = async (e) => {
    e.preventDefault();
    if (settings.outboundProxyEnabled !== true) return;
    setProxyLoading(true);
    setProxyStatus({ type: "", message: "" });
    try {
      await patchSettings({
        outboundProxyUrl: proxyForm.outboundProxyUrl,
        outboundNoProxy: proxyForm.outboundNoProxy,
      });
      setProxyStatus({ type: "success", message: "Proxy settings applied" });
    } catch (err) {
      setProxyStatus({ type: "error", message: err.message || "An error occurred" });
    } finally {
      setProxyLoading(false);
    }
  };
  const testOutboundProxy = async () => {
    if (settings.outboundProxyEnabled !== true) return;
    const proxyUrl = (proxyForm.outboundProxyUrl || "").trim();
    if (!proxyUrl) {
      setProxyStatus({ type: "error", message: "Please enter a Proxy URL to test" });
      return;
    }
    setProxyTestLoading(true);
    setProxyStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings/proxy-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyUrl }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setProxyStatus({
          type: "success",
          message: `Proxy test OK (${data.status}) in ${data.elapsedMs}ms`,
        });
      } else {
        setProxyStatus({
          type: "error",
          message: data?.error || "Proxy test failed",
        });
      }
    } catch (err) {
      setProxyStatus({ type: "error", message: "An error occurred" });
    } finally {
      setProxyTestLoading(false);
    }
  };
  const updateOutboundProxyEnabled = async (outboundProxyEnabled) => {
    setProxyLoading(true);
    setProxyStatus({ type: "", message: "" });
    try {
      const data = await patchSettings({ outboundProxyEnabled });
      setProxyForm((prev) => ({ ...prev, outboundProxyEnabled: data?.outboundProxyEnabled === true }));
      setProxyStatus({
        type: "success",
        message: outboundProxyEnabled ? "Proxy enabled" : "Proxy disabled",
      });
    } catch (err) {
      setProxyStatus({ type: "error", message: err.message || "An error occurred" });
    } finally {
      setProxyLoading(false);
    }
  };
  const updateFallbackStrategy = async (strategy) => {
    try {
      await patchSettings({ fallbackStrategy: strategy });
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  };
  const updateComboStrategy = async (strategy) => {
    try {
      await patchSettings({ comboStrategy: strategy });
    } catch (err) {
      console.error("Failed to update combo strategy:", err);
    }
  };
  const updateStickyLimit = async (limit) => {
    const numLimit = parseInt(limit);
    if (isNaN(numLimit) || numLimit < 1) return;
    try {
      await patchSettings({ stickyRoundRobinLimit: numLimit });
    } catch (err) {
      console.error("Failed to update sticky limit:", err);
    }
  };
  const updateRequireLogin = async (requireLogin) => {
    try {
      await patchSettings({ requireLogin });
    } catch (err) {
      console.error("Failed to update require login:", err);
    }
  };
  const updateObservabilityEnabled = async (enabled) => {
    try {
      await patchSettings({ enableObservability: enabled });
    } catch (err) {
      console.error("Failed to update enableObservability:", err);
    }
  };
  const reloadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      applySettings(data);
    } catch (err) {
      console.error("Failed to reload settings:", err);
    }
  };
  const handleExportDatabase = async () => {
    setDbLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings/database");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export database");
      }
      const payload = await res.json();
      const content = JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[.:]/g, "-");
      anchor.href = url;
      anchor.download = `xlabrouter-backup-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setDbStatus({ type: "success", message: "Backup downloaded (database + usage)" });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Failed to export database" });
    } finally {
      setDbLoading(false);
    }
  };
  const handleImportDatabase = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDbLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const res = await fetch("/api/settings/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to import database");
      }
      const importMode = data?.importMode;
      if (importMode === "usage") {
        setDbStatus({ type: "success", message: "Usage backup imported successfully" });
      } else if (importMode === "bundle") {
        setDbStatus({ type: "success", message: "Backup imported successfully (database + usage)" });
      } else {
        setDbStatus({ type: "success", message: "Database backup imported successfully" });
      }
      reloadSettings();
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Invalid backup file" });
    } finally {
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
      setDbLoading(false);
    }
  };
  const postGistBackup = async (body) => {
    const res = await fetch("/api/settings/gist-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const rawText = await res.text().catch(() => "");
    let data = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { error: rawText };
      }
    }
    if (!res.ok) throw new Error(data.error || "GitHub Gist backup failed");
    if (data.config) {
      setGistConfig(data.config);
    }
    return data;
  };
  const connectGitHubCli = async () => {
    setGistLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const data = await postGistBackup({ action: "use-gh-cli" });
      if (data?.requiresLogin) {
        setDbStatus({ type: data?.launched ? "success" : "error", message: data.error || "GitHub CLI login is required" });
      } else {
        setDbStatus({ type: "success", message: data.config?.hasToken ? "Connected using GitHub CLI" : "GitHub CLI token was not found" });
      }
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Failed to connect via GitHub CLI" });
    } finally {
      setGistLoading(false);
    }
  };
  const runGistBackup = async (action) => {
    setGistLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const data = await postGistBackup({ action });
      if (action === "restore") {
          setDbStatus({ type: "success", message: "Restored backup from GitHub Gist" });
        reloadSettings();
      } else if (action === "sync") {
        setDbStatus({
          type: "success",
          message: data.direction === "pull"
            ? "Synced from shared GitHub Gist to this machine"
            : "Synced this machine to shared GitHub Gist",
        });
        if (data.warning) {
          setDbStatus({ type: "success", message: `${data.direction === "pull" ? "Synced from shared GitHub Gist to this machine" : "Synced this machine to shared GitHub Gist"} (remote backup had issues, local backup replaced it)` });
        }
        if (data.direction === "pull") reloadSettings();
      } else {
          setDbStatus({ type: "success", message: `Backup saved to GitHub Gist ${data.config?.gistId || ""}` });
      }
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "GitHub Gist backup failed" });
    } finally {
      setGistLoading(false);
    }
  };

  const rotateOAuthQr = async () => {
    setPassLoading(true);
    setPassStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/auth/oauth-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to rotate Authenticator QR");
      }
      if (data?.url) setOauthSetupUrl(data.url);
      if (data?.secret) setOauthSetupSecret(data.secret);
      setPassStatus({ type: "success", message: "Authenticator secret đã được đổi. Backup mới sẽ giữ mã này cho tới lần đổi tiếp theo." });
    } catch (err) {
      setPassStatus({ type: "error", message: err.message || "Failed to rotate Authenticator QR" });
    } finally {
      setPassLoading(false);
    }
  };

  const copyOauthSecret = async () => {
    if (!oauthSetupSecret) return;
    try {
      await navigator.clipboard.writeText(oauthSetupSecret);
      setPassStatus({ type: "success", message: "Copied authenticator secret" });
    } catch {
      setPassStatus({ type: "error", message: "Cannot copy authenticator secret" });
    }
  };

  const copyBackupCodes = async () => {
    if (!backupCodes.length) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setPassStatus({ type: "success", message: "Copied backup codes" });
    } catch {
      setPassStatus({ type: "error", message: "Cannot copy backup codes" });
    }
  };

  const verifyAuthenticatorCode = async (event) => {
    event?.preventDefault();
    const code = authenticatorCode.trim();
    if (!code) {
      setPassStatus({ type: "error", message: "Nhập mã 2FA trước khi kiểm tra" });
      return;
    }

    setAuthenticatorCheckLoading(true);
    setPassStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/auth/oauth-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data.error || "Invalid authenticator code");
      setAuthenticatorCode("");
      setPassStatus({ type: "success", message: "Mã 2FA hợp lệ. Authenticator đã hoạt động thành công." });
      const qrRes = await fetch("/api/auth/oauth-qr", { cache: "no-store" });
      const qrData = await qrRes.json().catch(() => ({}));
      if (typeof qrData?.backupCodeCount === "number") setBackupCodeCount(qrData.backupCodeCount);
    } catch (err) {
      setPassStatus({ type: "error", message: err.message || "Mã 2FA không hợp lệ" });
    } finally {
      setAuthenticatorCheckLoading(false);
    }
  };

  const generateBackupCodesNow = async () => {
    setPassLoading(true);
    setPassStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/auth/oauth-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-backup-codes" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to generate backup codes");
      setBackupCodes(Array.isArray(data.codes) ? data.codes : []);
      if (typeof data?.backupCodeCount === "number") setBackupCodeCount(data.backupCodeCount);
      setPassStatus({ type: "success", message: "Generated new backup codes. Save them now (shown once)." });
    } catch (err) {
      setPassStatus({ type: "error", message: err.message || "Failed to generate backup codes" });
    } finally {
      setPassLoading(false);
    }
  };

  const disconnectGistBackup = async () => {
    setGistLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const data = await postGistBackup({ action: "disconnect" });
      setGistConfig(data.config);
      setDbStatus({ type: "success", message: "GitHub Gist backup disconnected" });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Failed to disconnect Gist backup" });
    } finally {
      setGistLoading(false);
    }
  };
  const runGoogleSync = async (action) => {
    setGoogleLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/auth/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Google sync failed");
      if (action === "restore") {
        setDbStatus({ type: "success", message: "Restored data from Google Drive backup" });
        reloadSettings();
      } else {
        setDbStatus({ type: "success", message: "Backed up data to Google Drive" });
      }
      const statusRes = await fetch("/api/auth/google/status");
      const status = await statusRes.json().catch(() => ({}));
      setGoogleStatus({
        configured: !!status?.configured,
        connected: !!status?.connected,
        email: status?.email || "",
        backup: status?.backup || null,
      });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Google sync failed" });
    } finally {
      setGoogleLoading(false);
    }
  };
  const disconnectGoogle = async () => {
    setGoogleLoading(true);
    try {
      await fetch("/api/auth/google/disconnect", { method: "POST" });
      setGoogleStatus({ configured: googleStatus.configured, connected: false, email: "", backup: null });
      setDbStatus({ type: "success", message: "Disconnected Google Drive" });
    } catch {
      setDbStatus({ type: "error", message: "Failed to disconnect Google Drive" });
    } finally {
      setGoogleLoading(false);
    }
  };
  const securityLoading = sectionLoading.security;
  const routingLoading = sectionLoading.routing;
  const networkLoading = sectionLoading.network;
  const observabilityLoading = sectionLoading.observability;
  const observabilityEnabled = settings.enableObservability === true;
  const requireLoginEnabled = settings.requireLogin === true;
  const roundRobinEnabled = settings.fallbackStrategy === "round-robin";
  const outboundProxyEnabled = settings.outboundProxyEnabled === true;
  const showSettingsFallbackNotice = settingsLoadError;
  const stickyRoundRobinLimit = settings.stickyRoundRobinLimit || 3;
  const comboRoundRobinEnabled = settings.comboStrategy === "round-robin";
  const renderFallbackNotice = () => (
    showSettingsFallbackNotice ? (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Showing default values while settings reload in the background.
      </p>
    ) : null
  );
  const renderInlineSkeleton = (wide = false) => <InlineSettingSkeleton wide={wide} />;
  const disableSecurityControls = securityLoading || passLoading;
  const disableRoutingControls = routingLoading;
  const disableNetworkControls = networkLoading || proxyLoading;
  const disableObservabilityControls = observabilityLoading;
  const showSecurityForm = !securityLoading && requireLoginEnabled;
  const showStickyLimit = !routingLoading && roundRobinEnabled;
  const showProxyForm = !networkLoading && outboundProxyEnabled;
  void isDark;
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col gap-6">
        {/* Local Mode Info */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">computer</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">Local Mode</h2>
                <p className="text-text-muted">Running on your machine</p>
              </div>
            </div>
            <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5">
              {["light", "dark", "system"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all",
                    theme === option
                      ? "bg-white dark:bg-white/10 text-text-main shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {option === "light" ? "light_mode" : option === "dark" ? "dark_mode" : "contrast"}
                  </span>
                  <span className="capitalize text-sm">{option}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border">
              <div>
                <p className="font-medium">Database Location</p>
                <p className="text-sm text-text-muted font-mono">~/.xlabrouter/db.json</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon="download"
                onClick={handleExportDatabase}
                loading={dbLoading}
              >
                Download Backup
              </Button>
              <Button
                variant="outline"
                icon="upload"
                onClick={() => importFileRef.current?.click()}
                disabled={dbLoading}
              >
                Import Backup
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportDatabase}
              />
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">GitHub Gist Backup</p>
                  <p className="text-sm text-text-muted">Dùng chung 1 file JSON backup với Import/Export.</p>
                  {gistConfig.gistId ? (
                    <p className="text-xs text-text-muted mt-1 break-all">
                      Gist connected
                      {gistConfig.updatedAt ? ` - Updated ${new Date(gistConfig.updatedAt).toLocaleString()}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-xs px-2 py-1 rounded-full border whitespace-nowrap", gistConfig.hasToken ? "text-green-600 border-green-500/30 bg-green-500/10" : "text-text-muted border-border") }>
                    {gistConfig.hasToken ? "CLI" : "Off"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon="terminal" onClick={connectGitHubCli} loading={gistLoading}>
                  Dùng GitHub CLI
                </Button>
                <Button variant="secondary" size="sm" icon="sync" onClick={() => runGistBackup("sync")} loading={gistLoading}>
                  Sync
                </Button>
                <Button variant="secondary" size="sm" icon="cloud_upload" onClick={() => runGistBackup("backup")} loading={gistLoading}>
                  Backup
                </Button>
                <Button variant="outline" size="sm" icon="cloud_download" onClick={() => runGistBackup("restore")} loading={gistLoading}>
                  Restore
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnectGistBackup} disabled={gistLoading || !gistConfig.hasToken}>
                  Disconnect
                </Button>
              </div>
            </div>
            {dbStatus.message && (
              <p className={`text-sm ${dbStatus.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                {dbStatus.message}
              </p>
            )}
          </div>
        </Card>
        {/* Security */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <h3 className="text-lg font-semibold">Security</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Require login</p>
                <p className="text-sm text-text-muted">
                  When ON, dashboard requires Google Authenticator login (QR). Localhost access bypasses login.
                </p>
              </div>
              <Toggle
                checked={requireLoginEnabled}
                onChange={() => updateRequireLogin(!requireLoginEnabled)}
                disabled={disableSecurityControls}
              />
            </div>
            {securityLoading ? (
              <div className="pt-4 border-t border-border/50 flex flex-col gap-4">
                {renderInlineSkeleton(true)}
                {renderInlineSkeleton(true)}
              </div>
            ) : null}
            {renderFallbackNotice()}
            {showSecurityForm && (
              <div className="flex flex-col gap-4 pt-4 border-t border-border/50">
                <p className="text-sm text-text-muted">
                  Password setup has been replaced by Google Authenticator login. Scan this QR to authenticate.
                </p>
                <p className="text-xs text-text-muted">
                  QR này là mã TOTP chuẩn cho Google Authenticator và sẽ giữ nguyên qua backup/restore cho tới khi bạn bấm Đổi Authenticator.
                </p>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
                  <div>
                    {oauthSetupQrUrl ? (
                      <img
                        src={oauthSetupQrUrl}
                        alt="Authenticator setup QR"
                        width={220}
                        height={220}
                        className="rounded-lg border border-border"
                      />
                    ) : (
                      <div className="h-[220px] w-[220px] rounded-lg border border-border flex items-center justify-center text-sm text-text-muted">
                        Preparing Authenticator QR...
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {oauthSetupSecret ? (
                      <div className="text-xs text-text-muted break-all flex flex-wrap items-center gap-2">
                        <span>Secret: <span className="font-mono text-text-main">{oauthSetupSecret}</span></span>
                        <Button type="button" variant="ghost" size="sm" onClick={copyOauthSecret} disabled={passLoading}>Copy Secret</Button>
                      </div>
                    ) : null}

                    <p className="text-xs text-text-muted">Backup codes remaining: <span className="font-semibold text-text-main">{backupCodeCount}</span></p>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={showAuthenticatorCheck ? "expand_less" : "verified_user"}
                        onClick={() => setShowAuthenticatorCheck((value) => !value)}
                        className="self-start"
                      >
                        {showAuthenticatorCheck ? "Ẩn kiểm tra 2FA" : "Kiểm tra mã 2FA"}
                      </Button>

                      {showAuthenticatorCheck ? (
                        <form onSubmit={verifyAuthenticatorCode} className="flex flex-col gap-2 rounded-lg border border-border/40 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <Input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              placeholder="123456"
                              value={authenticatorCode}
                              onChange={(event) => setAuthenticatorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                              disabled={passLoading || authenticatorCheckLoading}
                              className="flex-1"
                              hint="Nhập mã 6 số từ Google Authenticator để xác nhận QR/secret đã hoạt động."
                            />
                            <Button
                              type="submit"
                              variant="secondary"
                              size="sm"
                              loading={authenticatorCheckLoading}
                              disabled={passLoading || authenticatorCheckLoading || authenticatorCode.length !== 6}
                              className="sm:mb-[22px]"
                            >
                              Check 2FA
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
                {backupCodes.length > 0 ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-orange-500 mb-2">Shown only once. Save immediately.</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{backupCodes.join("\n")}</pre>
                  </div>
                ) : null}
                {passStatus.message && (
                  <p className={`text-sm ${passStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                    {passStatus.message}
                  </p>
                )}
                <div className="pt-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={rotateOAuthQr}
                      disabled={passLoading}
                    >
                      Đổi Authenticator
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={generateBackupCodesNow}
                      disabled={passLoading}
                    >
                      Generate Backup Codes
                    </Button>
                    {backupCodes.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={copyBackupCodes}
                        disabled={passLoading}
                      >
                        Copy Backup Codes
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Routing Preferences */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <span className="material-symbols-outlined text-[20px]">route</span>
            </div>
            <h3 className="text-lg font-semibold">Routing Strategy</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Round Robin</p>
                <p className="text-sm text-text-muted">
                  Cycle through accounts to distribute load
                </p>
              </div>
              <Toggle
                checked={roundRobinEnabled}
                onChange={() => updateFallbackStrategy(roundRobinEnabled ? "fill-first" : "round-robin")}
                disabled={disableRoutingControls}
              />
            </div>
            {routingLoading ? (
              <div className="pt-2 border-t border-border/50 flex flex-col gap-4">
                {renderInlineSkeleton(true)}
                {renderInlineSkeleton(true)}
              </div>
            ) : null}
            {renderFallbackNotice()}
            {/* Sticky Round Robin Limit */}
            {showStickyLimit && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div>
                  <p className="font-medium">Sticky Limit</p>
                  <p className="text-sm text-text-muted">
                    Calls per account before switching
                  </p>
                </div>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={stickyRoundRobinLimit}
                  onChange={(e) => updateStickyLimit(e.target.value)}
                  disabled={disableRoutingControls}
                  className="w-20 text-center"
                />
              </div>
            )}
            {/* Combo Round Robin */}
            {!routingLoading && (
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div>
                  <p className="font-medium">Combo Round Robin</p>
                  <p className="text-sm text-text-muted">
                    Cycle through providers in combos instead of always starting with first
                  </p>
                </div>
                <Toggle
                  checked={comboRoundRobinEnabled}
                  onChange={() => updateComboStrategy(comboRoundRobinEnabled ? "fallback" : "round-robin")}
                  disabled={disableRoutingControls}
                />
              </div>
            )}
            {!routingLoading && (
              <p className="text-xs text-text-muted italic pt-2 border-t border-border/50">
                {roundRobinEnabled
                  ? `Currently distributing requests across all available accounts with ${stickyRoundRobinLimit} calls per account.`
                  : "Currently using accounts in priority order (Fill First)."}
              </p>
            )}
          </div>
        </Card>
        {/* Network */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <span className="material-symbols-outlined text-[20px]">wifi</span>
            </div>
            <h3 className="text-lg font-semibold">Network</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Outbound Proxy</p>
                <p className="text-sm text-text-muted">Enable proxy for OAuth + provider outbound requests.</p>
              </div>
              <Toggle
                checked={outboundProxyEnabled}
                onChange={() => updateOutboundProxyEnabled(!outboundProxyEnabled)}
                disabled={disableNetworkControls}
              />
            </div>
            {networkLoading ? (
              <div className="pt-2 border-t border-border/50 flex flex-col gap-4">
                {renderInlineSkeleton(true)}
                {renderInlineSkeleton(true)}
              </div>
            ) : null}
            {renderFallbackNotice()}
            {showProxyForm && (
              <form onSubmit={updateOutboundProxy} className="flex flex-col gap-4 pt-2 border-t border-border/50">
                <div className="flex flex-col gap-2">
                  <label className="font-medium">Proxy URL</label>
                  <Input
                    placeholder="http://127.0.0.1:7897"
                    value={proxyForm.outboundProxyUrl}
                    onChange={(e) => setProxyForm((prev) => ({ ...prev, outboundProxyUrl: e.target.value }))}
                    disabled={disableNetworkControls}
                  />
                  <p className="text-sm text-text-muted">Leave empty to inherit existing env proxy (if any).</p>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                  <label className="font-medium">No Proxy</label>
                  <Input
                    placeholder="localhost,127.0.0.1"
                    value={proxyForm.outboundNoProxy}
                    onChange={(e) => setProxyForm((prev) => ({ ...prev, outboundNoProxy: e.target.value }))}
                    disabled={disableNetworkControls}
                  />
                  <p className="text-sm text-text-muted">Comma-separated hostnames/domains to bypass the proxy.</p>
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={proxyTestLoading}
                    disabled={disableNetworkControls}
                    onClick={testOutboundProxy}
                  >
                    Test proxy URL
                  </Button>
                  <Button type="submit" variant="primary" loading={proxyLoading}>
                    Apply
                  </Button>
                </div>
              </form>
            )}
            {proxyStatus.message && (
              <p className={`text-sm ${proxyStatus.type === "error" ? "text-red-500" : "text-green-500"} pt-2 border-t border-border/50`}>
                {proxyStatus.message}
              </p>
            )}
          </div>
        </Card>
        {/* Observability Settings */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <span className="material-symbols-outlined text-[20px]">monitoring</span>
            </div>
            <h3 className="text-lg font-semibold">Observability</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Observability</p>
                <p className="text-sm text-text-muted">
                  Record request details for inspection in the logs view
                </p>
              </div>
              <Toggle
                checked={observabilityEnabled}
                onChange={updateObservabilityEnabled}
                disabled={disableObservabilityControls}
              />
            </div>
            {observabilityLoading ? renderInlineSkeleton(true) : null}
            {renderFallbackNotice()}
          </div>
        </Card>
        {/* App Info */}
        <div className="text-center text-sm text-text-muted py-4">
          <p>{APP_CONFIG.name} v{APP_CONFIG.version}</p>
          <p className="mt-1">Local Mode - All data stored on your machine</p>
        </div>
      </div>
    </div>
  );
}
