import crypto from "crypto";
import os from "os";
import fs from "fs";
import path from "path";
import { loadState, saveState, generateShortId } from "./state.js";
import { spawnQuickTunnel, spawnCloudflared, killCloudflared, isCloudflaredRunning, setUnexpectedExitHandler } from "./cloudflared.js";
import { spawnNgrok, killNgrok, isNgrokRunning } from "./ngrok.js";
import { startFunnel, stopFunnel, stopDaemon, isTailscaleRunning, isTailscaleLoggedIn, startLogin, startDaemonWithPassword, getTailscaleAuthUrl, triggerTailscaleSystemLogin } from "./tailscale.js";
import { getSettings, updateSettings } from "@/lib/localDb";
import { DATA_DIR } from "@/lib/dataDir.js";
import { getCachedPassword, loadEncryptedPassword, initDbHooks } from "@/mitm/manager";

initDbHooks(getSettings, updateSettings);

const TUNNEL_PUBLIC_DOMAIN = process.env.TUNNEL_PUBLIC_DOMAIN || "";
const TUNNEL_WORKER_URL = process.env.TUNNEL_WORKER_URL || "";
const WORKER_URL = TUNNEL_WORKER_URL || (TUNNEL_PUBLIC_DOMAIN ? `https://${TUNNEL_PUBLIC_DOMAIN}` : "");
const CLOUDFLARE_TUNNEL_TOKEN = process.env.CLOUDFLARE_TUNNEL_TOKEN || process.env.TUNNEL_TOKEN || "";
const CLOUDFLARE_TUNNEL_PUBLIC_URL = process.env.CLOUDFLARE_TUNNEL_PUBLIC_URL || process.env.CLOUDFLARE_TUNNEL_HOSTNAME || "";
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN || process.env.NGROK_AUTH_TOKEN || "";
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || "";
const MACHINE_ID_SALT = "xlabrouter-tunnel-salt";
const RECONNECT_DELAYS_MS = [5000, 10000, 20000, 30000, 60000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length;
const IS_WINDOWS = os.platform() === "win32";
const STATUS_CACHE_TTL_MS = Number(process.env.TUNNEL_STATUS_CACHE_TTL_MS) > 0
  ? Number(process.env.TUNNEL_STATUS_CACHE_TTL_MS)
  : 30000;

let isReconnecting = false;
let exitHandlerRegistered = false;
let reconnectTimeoutId = null;
let manualDisabled = false;
let cachedTunnelStatus = null;
let cachedTunnelStatusAt = 0;
let cachedTailscaleStatus = null;
let cachedTailscaleStatusAt = 0;


export function isTunnelManuallyDisabled() {
  return manualDisabled;
}

export function isTunnelReconnecting() {
  return isReconnecting;
}

function getMachineId() {
  try {
    const { machineIdSync } = require("node-machine-id");
    const raw = machineIdSync();
    return crypto.createHash("sha256").update(raw + MACHINE_ID_SALT).digest("hex").substring(0, 16);
  } catch (e) {
    return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  }
}

function shouldUseCachedStatus(cachedAt) {
  return cachedAt > 0 && Date.now() - cachedAt < STATUS_CACHE_TTL_MS;
}

function normalizeUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function getNamedTunnelPublicUrl() {
  return normalizeUrl(CLOUDFLARE_TUNNEL_PUBLIC_URL);
}

function getComputedPublicUrl(shortId) {
  if (!shortId) return "";
  const namedTunnelPublicUrl = getNamedTunnelPublicUrl();
  if (namedTunnelPublicUrl) return namedTunnelPublicUrl;
  return TUNNEL_PUBLIC_DOMAIN ? `https://r${shortId}.${TUNNEL_PUBLIC_DOMAIN}` : "";
}

function createRuntimeBackup(tag) {
  try {
    if (!DATA_DIR || !fs.existsSync(DATA_DIR)) return;

    const backupDir = path.join(DATA_DIR, "backups", "runtime");
    fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = tag ? `-${tag}` : "";

    const files = ["db.json", "usage.json", "request-details.json"];
    for (const file of files) {
      const source = path.join(DATA_DIR, file);
      if (!fs.existsSync(source)) continue;
      const target = path.join(backupDir, `${stamp}${suffix}-${file}`);
      fs.copyFileSync(source, target);
    }

    const allBackups = fs.readdirSync(backupDir)
      .map((name) => ({ name, path: path.join(backupDir, name), mtime: fs.statSync(path.join(backupDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    const maxBackupFiles = 90;
    for (const backup of allBackups.slice(maxBackupFiles)) {
      try { fs.unlinkSync(backup.path); } catch { /* ignore */ }
    }
  } catch {
    // Ignore backup errors to avoid blocking tunnel operations
  }
}

function isNgrokUrl(url) {
  if (!url) return false;
  return /https:\/\/.+ngrok.+/i.test(url);
}

async function resolveNgrokPublicUrl() {
  try {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels");
    if (!response.ok) return "";
    const data = await response.json();
    const tunnel = data?.tunnels?.find((item) => item?.proto === "https");
    return tunnel?.public_url || "";
  } catch {
    return "";
  }
}

// ─── Cloudflare Tunnel ───────────────────────────────────────────────────────

async function registerTunnelUrl(shortId, tunnelUrl) {
  if (!WORKER_URL) return false;

  const response = await fetch(`${WORKER_URL}/api/tunnel/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortId, tunnelUrl })
  });

  if (!response.ok) {
    let message = `Tunnel register failed (${response.status})`;
    try {
      const text = await response.text();
      if (text) message = `${message}: ${text}`;
    } catch {
      // ignore parse error and keep generic message
    }
    throw new Error(message);
  }
}

export async function enableTunnel(localPort = 1212, provider = "cloudflare") {
  createRuntimeBackup(`before-enable-${provider}`);
  manualDisabled = false;
  cachedTunnelStatusAt = 0;
  cachedTunnelStatus = null;
  const namedTunnelPublicUrl = getNamedTunnelPublicUrl();
  const useNamedTunnel = !!CLOUDFLARE_TUNNEL_TOKEN;

  if (provider === "ngrok") {
    if (isNgrokRunning()) {
      const existingNgrok = loadState();
      if (isNgrokUrl(existingNgrok?.tunnelUrl)) {
        return {
          success: true,
          tunnelUrl: existingNgrok.tunnelUrl,
          shortId: existingNgrok.shortId,
          publicUrl: existingNgrok.tunnelUrl,
          provider: "ngrok",
          alreadyRunning: true
        };
      }
    }

    killCloudflared();
    killNgrok();

    const machineId = getMachineId();
    const existingNgrok = loadState();
    const shortId = existingNgrok?.shortId || generateShortId();
    // If NGROK_AUTHTOKEN is empty, ngrok can still use token saved by `ngrok config add-authtoken`.
    const { tunnelUrl } = await spawnNgrok(localPort, NGROK_AUTHTOKEN || "", NGROK_DOMAIN || null);

    saveState({ shortId, machineId, tunnelUrl });
    await updateSettings({ tunnelEnabled: true, tunnelUrl, tunnelProvider: "ngrok" });
    return { success: true, tunnelUrl, shortId, publicUrl: tunnelUrl, provider: "ngrok" };
  }

  if (isCloudflaredRunning()) {
    const existing = loadState();
    if (existing?.tunnelUrl) {
      const publicUrl = getComputedPublicUrl(existing.shortId);
      return { success: true, tunnelUrl: existing.tunnelUrl, shortId: existing.shortId, publicUrl, alreadyRunning: true };
    }
  }

  killCloudflared();

  const machineId = getMachineId();
  const existing = loadState();
  const shortId = existing?.shortId || generateShortId();

  if (useNamedTunnel) {
    await spawnCloudflared(CLOUDFLARE_TUNNEL_TOKEN);
    const tunnelUrl = namedTunnelPublicUrl || existing?.tunnelUrl || "";
    saveState({ shortId, machineId, tunnelUrl });
    await updateSettings({ tunnelEnabled: true, tunnelUrl, tunnelProvider: "cloudflare" });

    if (!exitHandlerRegistered) {
      setUnexpectedExitHandler(() => {
        if (!isReconnecting) scheduleReconnect(0);
      });
      exitHandlerRegistered = true;
    }

    return { success: true, tunnelUrl, shortId, publicUrl: getComputedPublicUrl(shortId), mode: "named" };
  }

  // onUrlUpdate: called when URL changes AFTER initial connect
  const onUrlUpdate = async (url) => {
    if (manualDisabled) return;
    await registerTunnelUrl(shortId, url);
    saveState({ shortId, machineId, tunnelUrl: url });
    await updateSettings({ tunnelEnabled: true, tunnelUrl: url, tunnelProvider: "cloudflare" });
  };

  const { tunnelUrl } = await spawnQuickTunnel(localPort, onUrlUpdate);

  await registerTunnelUrl(shortId, tunnelUrl);
  saveState({ shortId, machineId, tunnelUrl });
  await updateSettings({ tunnelEnabled: true, tunnelUrl, tunnelProvider: "cloudflare" });

  if (!exitHandlerRegistered) {
    setUnexpectedExitHandler(() => {
      if (!isReconnecting) scheduleReconnect(0);
    });
    exitHandlerRegistered = true;
  }

  const publicUrl = getComputedPublicUrl(shortId);
  return { success: true, tunnelUrl, shortId, publicUrl, provider: "cloudflare" };
}

async function scheduleReconnect(attempt) {
  if (isReconnecting || manualDisabled) return;
  isReconnecting = true;

  const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
  console.log(`[Tunnel] Reconnecting in ${delay / 1000}s (attempt ${attempt + 1})...`);

  await new Promise((r) => { reconnectTimeoutId = setTimeout(r, delay); });

  try {
    if (manualDisabled) { isReconnecting = false; return; }
    const settings = await getSettings();
    if (!settings.tunnelEnabled) { isReconnecting = false; return; }
    const provider = settings.tunnelProvider || "cloudflare";
    await enableTunnel(1212, provider);
    console.log("[Tunnel] Reconnected successfully");
    isReconnecting = false;
  } catch (err) {
    console.log(`[Tunnel] Reconnect attempt ${attempt + 1} failed:`, err.message);
    isReconnecting = false;
    const next = attempt + 1;
    if (next < MAX_RECONNECT_ATTEMPTS) scheduleReconnect(next);
    else {
      console.log("[Tunnel] All reconnect attempts exhausted, disabling tunnel");
      await updateSettings({ tunnelEnabled: false });
    }
  }
}

export async function disableTunnel() {
  createRuntimeBackup("before-disable-tunnel");
  manualDisabled = true;
  isReconnecting = true;
  cachedTunnelStatusAt = 0;
  cachedTunnelStatus = null;
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  setUnexpectedExitHandler(null);
  exitHandlerRegistered = false;

  killCloudflared();
  killNgrok();

  const state = loadState();
  if (state) {
    saveState({ shortId: state.shortId, machineId: state.machineId, tunnelUrl: null });
  }

  await updateSettings({ tunnelEnabled: false, tunnelUrl: "", tunnelProvider: "" });
  isReconnecting = false;
  return { success: true };
}

export async function getTunnelStatus(settingsOverride) {
  const state = loadState();
  const settings = settingsOverride || await getSettings();
  const shortId = state?.shortId || "";
  const publicUrl = getComputedPublicUrl(shortId);

  if (settings.tunnelEnabled !== true) {
    try {
      if (isNgrokRunning()) killNgrok();
      if (isCloudflaredRunning()) killCloudflared();
    } catch {
      // ignore cleanup errors
    }

    if (state) {
      saveState({ shortId: state.shortId, machineId: state.machineId, tunnelUrl: null });
    }

    cachedTunnelStatus = { running: false, tunnelUrl: "", provider: settings.tunnelProvider || "" };
    cachedTunnelStatusAt = Date.now();

    return {
      enabled: false,
      tunnelUrl: "",
      shortId,
      publicUrl,
      running: false,
      provider: settings.tunnelProvider || "",
    };
  }

  if (shouldUseCachedStatus(cachedTunnelStatusAt)) {
    return {
      ...cachedTunnelStatus,
      enabled: settings.tunnelEnabled === true && cachedTunnelStatus.running,
      tunnelUrl: state?.tunnelUrl || cachedTunnelStatus.tunnelUrl || "",
      provider: cachedTunnelStatus.provider || settings.tunnelProvider || "cloudflare",
      shortId,
      publicUrl,
    };
  }

  const provider = settings.tunnelProvider || "cloudflare";
  const running = provider === "ngrok" ? isNgrokRunning() : isCloudflaredRunning();

  let tunnelUrl = state?.tunnelUrl || "";
  if (provider === "ngrok") {
    const liveNgrokUrl = running ? await resolveNgrokPublicUrl() : "";
    if (liveNgrokUrl) {
      tunnelUrl = liveNgrokUrl;
      const existing = loadState();
      if (existing?.shortId || existing?.machineId) {
        saveState({
          shortId: existing.shortId,
          machineId: existing.machineId,
          tunnelUrl: liveNgrokUrl,
        });
      }
      await updateSettings({ tunnelUrl: liveNgrokUrl, tunnelProvider: "ngrok" });
    } else if (!isNgrokUrl(tunnelUrl)) {
      tunnelUrl = "";
    }
  }

  cachedTunnelStatus = { running, tunnelUrl, provider };
  cachedTunnelStatusAt = Date.now();

  return {
    enabled: settings.tunnelEnabled === true && running,
    tunnelUrl,
    shortId,
    publicUrl,
    running,
    provider
  };
}

// ─── Tailscale Funnel ─────────────────────────────────────────────────────────

export async function enableTailscale(localPort = 1212) {
  if (IS_WINDOWS && !isTailscaleLoggedIn()) {
    const immediateAuthUrl = getTailscaleAuthUrl() || "https://login.tailscale.com/start";
    triggerTailscaleSystemLogin();
    return { success: false, needsLogin: true, authUrl: immediateAuthUrl };
  }

  createRuntimeBackup("before-enable-tailscale");
  // Ensure daemon is running (needs sudo for TUN mode)
  const sudoPass = getCachedPassword() || await loadEncryptedPassword() || "";
  await startDaemonWithPassword(sudoPass);

  // Generate hostname from machine ID (same as tunnel shortId prefix)
  const existing = loadState();
  const shortId = existing?.shortId || generateShortId();
  const tsHostname = shortId;

  // If not logged in, return auth URL for user to authenticate
  if (!isTailscaleLoggedIn()) {
    const immediateAuthUrl = getTailscaleAuthUrl();
    triggerTailscaleSystemLogin();
    Promise.resolve().then(() => startLogin(tsHostname)).catch(() => {});
    if (immediateAuthUrl) {
      return { success: false, needsLogin: true, authUrl: immediateAuthUrl };
    }
    return { success: false, needsLogin: true };
  }

  stopFunnel();
  const result = await startFunnel(localPort);

  // Funnel not enabled on tailnet — return enable URL
  if (result.funnelNotEnabled) {
    return { success: false, funnelNotEnabled: true, enableUrl: result.enableUrl };
  }

  // Verify device is actually connected (BackendState=Running + funnel active)
  if (!isTailscaleLoggedIn() || !isTailscaleRunning()) {
    stopFunnel();
    return { success: false, error: "Tailscale not connected. Device may have been removed. Please re-login." };
  }

  await updateSettings({ tailscaleEnabled: true, tailscaleUrl: result.tunnelUrl });
  return { success: true, tunnelUrl: result.tunnelUrl };
}

export async function disableTailscale() {
  createRuntimeBackup("before-disable-tailscale");
  stopFunnel();
  const sudoPass = getCachedPassword() || await loadEncryptedPassword() || "";
  await stopDaemon(sudoPass);
  await updateSettings({ tailscaleEnabled: false, tailscaleUrl: "" });
  return { success: true };
}

export async function getTailscaleStatus(settingsOverride) {
  const settings = settingsOverride || await getSettings();

  if (shouldUseCachedStatus(cachedTailscaleStatusAt)) {
    return {
      ...cachedTailscaleStatus,
      enabled: settings.tailscaleEnabled === true && cachedTailscaleStatus.running,
      tunnelUrl: settings.tailscaleUrl || cachedTailscaleStatus.tunnelUrl || "",
    };
  }

  // Skip expensive check if tailscale is not enabled
  if (settings.tailscaleEnabled !== true) {
    cachedTailscaleStatus = { running: false, tunnelUrl: "" };
    cachedTailscaleStatusAt = Date.now();
    return {
      enabled: false,
      tunnelUrl: "",
      running: false
    };
  }

  const running = isTailscaleRunning();
  cachedTailscaleStatus = { running, tunnelUrl: settings.tailscaleUrl || "" };
  cachedTailscaleStatusAt = Date.now();

  return {
    enabled: settings.tailscaleEnabled === true && running,
    tunnelUrl: settings.tailscaleUrl || "",
    running
  };
}
