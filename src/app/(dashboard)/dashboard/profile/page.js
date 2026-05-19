"use client";
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, Button, Toggle, Input } from "@/shared/components";
import { Skeleton } from "@/shared/components/Loading";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import { fetchWithTimeout } from "@/shared/utils/fetchWithTimeout";
const INITIAL_SECTION_LOADING = {
  security: true,
  routing: true,
  network: true,
  observability: true,
};

const PROFILE_FAST_FETCH_TIMEOUT_MS = 8000;

const BASIC_CHAT_STORAGE_KEYS = {
  sessions: "basic-chat.sessions",
  activeSessionId: "basic-chat.activeSessionId",
  activeProviderId: "basic-chat.activeProviderId",
  draft: "basic-chat.draft",
};

function safeParseStorageJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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
  const [gistConfig, setGistConfig] = useState({ enabled: false, hasToken: false, hasRefreshToken: false, gistId: "", htmlUrl: "", updatedAt: "", tokenSource: "", githubLogin: "" });
  const [gistLoading, setGistLoading] = useState(false);
  const gistMenuRef = useRef(null);
  const [showGistMenu, setShowGistMenu] = useState(false);
  const [showGistTokenForm, setShowGistTokenForm] = useState(false);
  const [gistTokenForm, setGistTokenForm] = useState({ token: "", refreshToken: "" });
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
  const [showSecurityHelp, setShowSecurityHelp] = useState(false);
  const [showRoutingHelp, setShowRoutingHelp] = useState(false);
  const [showNetworkHelp, setShowNetworkHelp] = useState(false);
  const [showObservabilityHelp, setShowObservabilityHelp] = useState(false);
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
  const [accountForm, setAccountForm] = useState({
    currentUsername: "admin",
    currentPassword: "",
    username: "admin",
    password: "",
    confirmPassword: "",
  });
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState({ type: "", message: "" });
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const fetchJson = (url, timeoutMessage) =>
      fetchWithTimeout(url, { cache: "no-store" }, PROFILE_FAST_FETCH_TIMEOUT_MS, timeoutMessage)
        .then((res) => (res.ok ? res.json() : null));

    Promise.allSettled([
      fetchJson("/api/settings", "Loading profile settings timed out"),
      fetchJson("/api/auth/change-credentials", "Loading account settings timed out"),
      fetchJson("/api/auth/oauth-qr", "Loading authenticator setup timed out"),
      fetchJson(`/api/auth/google/status?t=${Date.now()}`, "Loading Google backup status timed out"),
      fetchJson("/api/settings/gist-backup", "Loading Gist backup status timed out"),
    ]).then(([settingsResult, accountResult, oauthResult, googleResult, gistResult]) => {
      if (cancelled) return;

      if (settingsResult.status === "fulfilled" && settingsResult.value) {
        applySettings(settingsResult.value);
      } else {
        console.error("Failed to fetch settings:", settingsResult.reason);
        setSectionLoading({
          security: false,
          routing: false,
          network: false,
          observability: false,
        });
        setSettingsLoadError(true);
      }

      const account = accountResult.status === "fulfilled" ? accountResult.value : null;
      if (account?.username) {
        setAccountForm((current) => ({
          ...current,
          currentUsername: account.username,
          username: account.username,
        }));
      }

      const oauth = oauthResult.status === "fulfilled" ? oauthResult.value : null;
      if (oauth?.url) setOauthSetupUrl(oauth.url);
      else setOauthSetupUrl("");
      if (oauth?.secret) setOauthSetupSecret(oauth.secret);
      if (typeof oauth?.backupCodeCount === "number") setBackupCodeCount(oauth.backupCodeCount);

      const google = googleResult.status === "fulfilled" ? googleResult.value : null;
      setGoogleStatus({
        loading: false,
        configured: !!google?.configured,
        connected: !!google?.connected,
        email: google?.email || "",
        backup: google?.backup || null,
        authSource: google?.authSource || "none",
        expectedRedirectUri: google?.expectedRedirectUri || "",
      });

      const gist = gistResult.status === "fulfilled" ? gistResult.value : null;
      if (gist) setGistConfig(gist);
    });

    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !showGistMenu) return undefined;

    const closeMenu = (event) => {
      if (gistMenuRef.current?.contains(event.target)) return;
      setShowGistMenu(false);
    };

    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [showGistMenu]);
  const InlineSettingSkeleton = ({ wide = false }) => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className={cn("h-3 w-48", wide && "w-64 max-w-full")} />
      </div>
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  );
  function applySettings(data) {
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
  }
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
      const res = await fetchWithTimeout("/api/settings", { cache: "no-store" }, PROFILE_FAST_FETCH_TIMEOUT_MS, "Reloading settings timed out");
      if (!res.ok) return;
      const data = await res.json();
      applySettings(data);
    } catch (err) {
      console.error("Failed to reload settings:", err);
    }
  };
  const syncBasicChatBackup = async () => {
    if (typeof window === "undefined") return;
    const state = {
      sessions: safeParseStorageJson(window.localStorage.getItem(BASIC_CHAT_STORAGE_KEYS.sessions), []),
      activeSessionId: window.localStorage.getItem(BASIC_CHAT_STORAGE_KEYS.activeSessionId) || "",
      activeProviderId: window.localStorage.getItem(BASIC_CHAT_STORAGE_KEYS.activeProviderId) || "",
      draft: window.localStorage.getItem(BASIC_CHAT_STORAGE_KEYS.draft) || "",
      updatedAt: new Date().toISOString(),
    };
    await fetch("/api/basic-chat/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  };
  const restoreBasicChatStorage = async () => {
    if (typeof window === "undefined") return;
    const res = await fetch("/api/basic-chat/state", { cache: "no-store" });
    if (!res.ok) return;
    const state = await res.json().catch(() => ({}));
    window.localStorage.setItem(BASIC_CHAT_STORAGE_KEYS.sessions, JSON.stringify(Array.isArray(state.sessions) ? state.sessions : []));
    window.localStorage.setItem(BASIC_CHAT_STORAGE_KEYS.activeSessionId, state.activeSessionId || "");
    window.localStorage.setItem(BASIC_CHAT_STORAGE_KEYS.activeProviderId, state.activeProviderId || "");
    window.localStorage.setItem(BASIC_CHAT_STORAGE_KEYS.draft, state.draft || "");
  };
  const handleExportDatabase = async () => {
    setDbLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      await syncBasicChatBackup();
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
      setDbStatus({ type: "success", message: "Backup downloaded (database + usage + chat)" });
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
      const sanitizedRaw = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1).trimStart() : raw.trimStart();
      const payload = JSON.parse(sanitizedRaw);
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
        setDbStatus({ type: "success", message: "Backup imported successfully (database + usage + chat)" });
      } else {
        setDbStatus({ type: "success", message: "Database backup imported successfully" });
      }
      await restoreBasicChatStorage();
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
    const action = String(body?.action || "sync");
    const controller = new AbortController();
    const timeoutByActionMs = {
      "use-gh-cli": 45000,
      "set-token": 45000,
      backup: 90000,
      restore: 120000,
      sync: 120000,
      disconnect: 30000,
    };
    const timeoutMs = timeoutByActionMs[action] || 90000;
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    let res;
    try {
      res = await fetch("/api/settings/gist-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Gist ${action} timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

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
      if (action !== "restore") {
        await syncBasicChatBackup();
      }
      const data = await postGistBackup({ action });
      if (action === "restore") {
          await restoreBasicChatStorage();
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
        if (data.direction === "pull") {
          await restoreBasicChatStorage();
          reloadSettings();
        }
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

  const changeAccountCredentials = async (event) => {
    event?.preventDefault();
    const { currentUsername, currentPassword, username, password, confirmPassword } = accountForm;
    if (!currentUsername.trim() || !currentPassword) {
      setAccountStatus({ type: "error", message: "Vui lòng nhập tài khoản và mật khẩu hiện tại" });
      return;
    }
    if (!username.trim()) {
      setAccountStatus({ type: "error", message: "Vui lòng nhập tên đăng nhập mới" });
      return;
    }
    if (!password) {
      setAccountStatus({ type: "error", message: "Vui lòng nhập mật khẩu mới" });
      return;
    }
    if (password !== confirmPassword) {
      setAccountStatus({ type: "error", message: "Mật khẩu xác nhận không khớp" });
      return;
    }
    setAccountLoading(true);
    setAccountStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/auth/change-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentUsername, currentPassword, username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Đổi tài khoản thất bại");
      setAccountForm((current) => ({
        ...current,
        currentUsername: data.username,
        username: data.username,
        currentPassword: "",
        password: "",
        confirmPassword: "",
      }));
      setAccountStatus({ type: "success", message: "Đổi tài khoản thành công" });
    } catch (err) {
      setAccountStatus({ type: "error", message: err.message || "Đổi tài khoản thất bại" });
    } finally {
      setAccountLoading(false);
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
  const saveGistToken = async (event) => {
    event.preventDefault();
    setGistLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const data = await postGistBackup({
        action: "set-token",
        token: gistTokenForm.token,
        refreshToken: gistTokenForm.refreshToken,
      });
      setGistConfig(data.config);
      setGistTokenForm({ token: "", refreshToken: "" });
      setShowGistTokenForm(false);
      setDbStatus({ type: "success", message: "GitHub token saved to db.json" });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Failed to save GitHub token" });
    } finally {
      setGistLoading(false);
    }
  };
  const runGoogleSync = async (action) => {
    setGoogleLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      if (action !== "restore") {
        await syncBasicChatBackup();
      }
      const res = await fetch("/api/auth/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Google sync failed");
      if (action === "restore") {
        await restoreBasicChatStorage();
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
  const showSecurityForm = false;
  const showStickyLimit = !routingLoading && roundRobinEnabled;
  const showProxyForm = !networkLoading && outboundProxyEnabled;
  void isDark;
  return (
    <div className="max-w-2xl mx-auto" data-i18n-skip>
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
                    {gistConfig.hasToken ? (gistConfig.tokenSource === "manual" ? "Manual" : "CLI") : "Off"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative" ref={gistMenuRef}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon="tune"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setShowGistMenu((value) => !value);
                    }}
                    disabled={gistLoading}
                  >
                    Tùy chọn Gist
                  </Button>
                  {showGistMenu ? (
                    <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-lg border border-border bg-sidebar p-1 shadow-lg">
                      <div role="menuitem" tabIndex={0} className="w-full cursor-pointer text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { setShowGistMenu(false); connectGitHubCli(); }}>Dùng GitHub CLI</div>
                      <div role="menuitem" tabIndex={0} className="w-full cursor-pointer text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { setShowGistMenu(false); setShowGistTokenForm((value) => !value); }}>Nhập token</div>
                      <div className="my-1 border-t border-border/60" />
                      <div role="menuitem" tabIndex={0} className="w-full cursor-pointer text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { setShowGistMenu(false); runGistBackup("sync"); }}>Sync</div>
                      <div role="menuitem" tabIndex={0} className="w-full cursor-pointer text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { setShowGistMenu(false); runGistBackup("backup"); }}>Backup</div>
                      <div role="menuitem" tabIndex={0} className="w-full cursor-pointer text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { setShowGistMenu(false); runGistBackup("restore"); }}>Restore</div>
                      <div className="my-1 border-t border-border/60" />
                      <div role="menuitem" aria-disabled={gistLoading || !gistConfig.hasToken} className={cn("w-full text-left px-3 py-2 text-sm rounded-md transition-colors", gistLoading || !gistConfig.hasToken ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/10")} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { if (gistLoading || !gistConfig.hasToken) return; setShowGistMenu(false); disconnectGistBackup(); }}>Disconnect</div>
                    </div>
                  ) : null}
                </div>
              </div>
              {showGistTokenForm ? (
                <form onSubmit={saveGistToken} className="grid gap-3 pt-3 border-t border-border/50 sm:grid-cols-2">
                  <Input
                    label="GitHub token"
                    type="password"
                    value={gistTokenForm.token}
                    onChange={(event) => setGistTokenForm((current) => ({ ...current, token: event.target.value }))}
                    autoComplete="off"
                    placeholder="ghp_... hoặc github_pat_..."
                    disabled={gistLoading}
                  />
                  <Input
                    label="GitHub refresh token"
                    type="password"
                    value={gistTokenForm.refreshToken}
                    onChange={(event) => setGistTokenForm((current) => ({ ...current, refreshToken: event.target.value }))}
                    autoComplete="off"
                    placeholder="Tùy chọn"
                    disabled={gistLoading}
                  />
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <Button type="submit" variant="primary" size="sm" loading={gistLoading}>
                      Lưu token
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowGistTokenForm(false)} disabled={gistLoading}>
                      Hủy
                    </Button>
                    <span className="text-xs text-text-muted">
                      Nhập GitHub token để dùng Gist ngay; refresh token được lưu kèm trong db.json nếu có.
                    </span>
                  </div>
                </form>
              ) : gistConfig.hasRefreshToken ? (
                <p className="text-xs text-text-muted">Refresh token đã được lưu trong db.json.</p>
              ) : null}
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
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <h3 className="text-lg font-semibold">Security</h3>
            </div>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon="help"
                onClick={() => setShowSecurityHelp((value) => !value)}
                aria-label="Security information"
                className="h-9 w-9 justify-center p-0"
              />
              {showSecurityHelp ? (
                <div className="absolute right-0 top-11 z-10 w-[260px] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-surface p-3 shadow-xl">
                  <div className="flex flex-col gap-2 text-xs text-text-muted">
                    <p>ON: đăng nhập bằng Google Authenticator.</p>
                    <p>Localhost được bỏ qua đăng nhập.</p>
                    <p>QR/secret giữ nguyên qua backup/restore.</p>
                    <p>Mã 2FA dùng để kiểm tra QR hoạt động.</p>
                    <p>Backup codes chỉ hiện một lần.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Require login</p>
              </div>
              <Toggle
                checked={requireLoginEnabled}
                onChange={() => updateRequireLogin(!requireLoginEnabled)}
                disabled={disableSecurityControls}
              />
            </div>
            {!securityLoading ? (
              <form onSubmit={changeAccountCredentials} className="flex flex-col gap-4 pt-4 border-t border-border/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                  </div>
                  <div>
                    <p className="font-medium">Quản lý tài khoản</p>
                    <p className="text-sm text-text-muted">Đổi tên đăng nhập và mật khẩu đăng nhập dashboard.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Tài khoản hiện tại"
                    type="text"
                    value={accountForm.currentUsername}
                    onChange={(event) => setAccountForm((current) => ({ ...current, currentUsername: event.target.value }))}
                    autoComplete="username"
                    disabled={accountLoading || disableSecurityControls}
                    required
                  />
                  <Input
                    label="Mật khẩu hiện tại"
                    type="password"
                    value={accountForm.currentPassword}
                    onChange={(event) => setAccountForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    autoComplete="current-password"
                    disabled={accountLoading || disableSecurityControls}
                    required
                  />
                  <Input
                    label="Tên đăng nhập mới"
                    type="text"
                    value={accountForm.username}
                    onChange={(event) => setAccountForm((current) => ({ ...current, username: event.target.value }))}
                    autoComplete="username"
                    disabled={accountLoading || disableSecurityControls}
                    required
                  />
                  <Input
                    label="Mật khẩu mới"
                    type="password"
                    value={accountForm.password}
                    onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))}
                    autoComplete="new-password"
                    disabled={accountLoading || disableSecurityControls}
                    required
                  />
                  <Input
                    label="Nhập lại mật khẩu mới"
                    type="password"
                    value={accountForm.confirmPassword}
                    onChange={(event) => setAccountForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    autoComplete="new-password"
                    disabled={accountLoading || disableSecurityControls}
                    required
                    className="sm:col-span-2"
                  />
                </div>
                {accountStatus.message ? (
                  <p className={`text-sm ${accountStatus.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                    {accountStatus.message}
                  </p>
                ) : null}
                <div>
                  <Button type="submit" variant="primary" loading={accountLoading} disabled={accountLoading || disableSecurityControls}>
                    Lưu tài khoản
                  </Button>
                </div>
              </form>
            ) : (
              <div className="pt-4 border-t border-border/50 flex flex-col gap-4">
                {renderInlineSkeleton(true)}
                {renderInlineSkeleton(true)}
              </div>
            )}
            {renderFallbackNotice()}
            {showSecurityForm && (
              <div className="flex flex-col gap-4 pt-4 border-t border-border/50">
                <div className="flex items-start gap-6 overflow-x-auto pb-2">
                  <div className="shrink-0">
                    {oauthSetupQrUrl ? (
                      <img
                        src={oauthSetupQrUrl}
                        alt="Authenticator setup QR"
                        width={188}
                        height={188}
                        className="rounded-lg border border-border"
                      />
                    ) : (
                      <div className="h-[188px] w-[188px] rounded-lg border border-border flex items-center justify-center text-sm text-text-muted">
                        Preparing Authenticator QR...
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[340px] flex-1 flex-col items-center justify-center gap-4 py-1">
                    {oauthSetupSecret ? (
                      <div className="flex min-w-0 items-center justify-center gap-3 overflow-x-auto whitespace-nowrap text-xs text-text-muted">
                        <span className="shrink-0">Secret: <span className="font-mono text-text-main">{oauthSetupSecret}</span></span>
                        <Button type="button" variant="ghost" size="sm" onClick={copyOauthSecret} disabled={passLoading} className="shrink-0">Copy Secret</Button>
                      </div>
                    ) : null}


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
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            loading={authenticatorCheckLoading}
                            disabled={passLoading || authenticatorCheckLoading || authenticatorCode.length !== 6}
                            className="sm:mb-[22px] shrink-0"
                          >
                            Check 2FA
                          </Button>
                        </div>
                      </form>
                    ) : null}

                    <div className="flex w-full flex-col items-center gap-3 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={showAuthenticatorCheck ? "expand_less" : "verified_user"}
                        onClick={() => setShowAuthenticatorCheck((value) => !value)}
                        className="w-full max-w-[340px] justify-center"
                      >
                        {showAuthenticatorCheck ? "Ẩn kiểm tra 2FA" : "Kiểm tra mã 2FA"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={rotateOAuthQr}
                        disabled={passLoading}
                        className="w-full max-w-[340px] justify-center"
                      >
                        Đổi Authenticator
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={generateBackupCodesNow}
                        disabled={passLoading}
                        className="w-full max-w-[340px] justify-center"
                      >
                        Generate Backup Codes
                      </Button>
                    </div>
                  </div>
                </div>
                {backupCodes.length > 0 ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-orange-500 mb-2">Backup codes ready.</p>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{backupCodes.join("\n")}</pre>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyBackupCodes}
                        disabled={passLoading}
                      >
                        Copy Backup Codes
                      </Button>
                    </div>
                  </div>
                ) : null}
                {passStatus.message && (
                  <p className={`text-sm ${passStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                    {passStatus.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Routing Preferences */}
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <span className="material-symbols-outlined text-[20px]">route</span>
              </div>
              <h3 className="text-lg font-semibold">Routing Strategy</h3>
            </div>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon="help"
                onClick={() => setShowRoutingHelp((value) => !value)}
                aria-label="Routing information"
                className="h-9 w-9 justify-center p-0"
              />
              {showRoutingHelp ? (
                <div className="absolute right-0 top-11 z-10 w-[260px] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-surface p-3 shadow-xl">
                  <div className="flex flex-col gap-2 text-xs text-text-muted">
                    <p>Round Robin: chia tải đều qua nhiều tài khoản.</p>
                    <p>Sticky Limit: số lượt gọi trước khi đổi tài khoản.</p>
                    <p>Combo Round Robin: luân phiên ngay trong combo.</p>
                    <p>Fill First: ưu tiên dùng tài khoản theo thứ tự.</p>
                  </div>
                </div>
              ) : null}
            </div>
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
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <span className="material-symbols-outlined text-[20px]">wifi</span>
              </div>
              <h3 className="text-lg font-semibold">Network</h3>
            </div>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon="help"
                onClick={() => setShowNetworkHelp((value) => !value)}
                aria-label="Network information"
                className="h-9 w-9 justify-center p-0"
              />
              {showNetworkHelp ? (
                <div className="absolute right-0 top-11 z-10 w-[260px] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-surface p-3 shadow-xl">
                  <div className="flex flex-col gap-2 text-xs text-text-muted">
                    <p>Bật Outbound Proxy để route traffic đi ra.</p>
                    <p>Proxy URL: địa chỉ proxy chính.</p>
                    <p>No Proxy: danh sách host bỏ qua proxy.</p>
                    <p>Test Proxy để kiểm tra kết nối trước khi Apply.</p>
                  </div>
                </div>
              ) : null}
            </div>
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
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                <span className="material-symbols-outlined text-[20px]">monitoring</span>
              </div>
              <h3 className="text-lg font-semibold">Observability</h3>
            </div>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon="help"
                onClick={() => setShowObservabilityHelp((value) => !value)}
                aria-label="Observability information"
                className="h-9 w-9 justify-center p-0"
              />
              {showObservabilityHelp ? (
                <div className="absolute right-0 top-11 z-10 w-[260px] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-surface p-3 shadow-xl">
                  <div className="flex flex-col gap-2 text-xs text-text-muted">
                    <p>Bật Observability để lưu chi tiết request.</p>
                    <p>Dữ liệu dùng cho log view và debug sự cố.</p>
                    <p>Nên bật khi cần kiểm tra hành vi hệ thống.</p>
                  </div>
                </div>
              ) : null}
            </div>
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

