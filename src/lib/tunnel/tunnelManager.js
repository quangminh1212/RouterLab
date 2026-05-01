import crypto from "crypto";
import os from "os";
import fs from "fs";
import path from "path";
import { loadState, saveState, generateShortId } from "./state.js";
import { spawnQuickTunnel, spawnCloudflared, killCloudflared, isCloudflaredRunning, isCloudflaredServiceInstalled, setUnexpectedExitHandler } from "./cloudflared.js";
import { spawnNgrok, killNgrok, isNgrokRunning } from "./ngrok.js";
import { startFunnel, stopFunnel, stopDaemon, isTailscaleRunning, isTailscaleLoggedIn, startLogin, startDaemonWithPassword, getTailscaleAuthUrl, triggerTailscaleSystemLogin } from "./tailscale.js";
import { getSettings, updateSettings } from "@/lib/localDb";
import { DATA_DIR } from "@/lib/dataDir.js";
import { getCachedPassword, loadEncryptedPassword, initDbHooks } from "@/mitm/manager";

initDbHooks(getSettings, updateSettings);

const TUNNEL_PUBLIC_DOMAIN = process.env.TUNNEL_PUBLIC_DOMAIN || "";
const TUNNEL_WORKER_URL = process.env.TUNNEL_WORKER_URL || "";
const WORKER_URL = TUNNEL_WORKER_URL || (TUNNEL_PUBLIC_DOMAIN ? `https://${TUNNEL_PUBLIC_DOMAIN}` : "");
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN || process.env.NGROK_AUTH_TOKEN || "";
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || "";
const MACHINE_ID_SALT = "xlabrouter-tunnel-salt";
const RECONNECT_DELAYS_MS = [5000, 10000, 20000, 30000, 60000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length;
const IS_WINDOWS = os.platform() === "win32";
const STATUS_CACHE_TTL_MS = Number(process.env.TUNNEL_STATUS_CACHE_TTL_MS) > 0
  ? Number(process.env.TUNNEL_STATUS_CACHE_TTL_MS)
  : 30000;
const CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS = [
  "Cloudflare One Connectors Write",
  "Cloudflare One Connector: cloudflared Write",
  "Cloudflare Tunnel Write",
];
const CLOUDFLARE_DNS_WRITE_PERMISSIONS = [
  "Zone DNS Read",
  "Zone DNS Edit",
];

let isReconnecting = false;
let exitHandlerRegistered = false;
let reconnectTimeoutId = null;
let manualDisabled = false;
let cachedTunnelStatus = null;
let cachedTunnelStatusAt = 0;
let cachedTailscaleStatus = null;
let cachedTailscaleStatusAt = 0;
let lastConnectorCleanupResult = null;
let isTunnelEnableInProgress = false;


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

function getCloudflareRuntimeConfig(settings = null) {
  const cf = settings?.cloudflare || {};
  return {
    apiToken: cf.apiToken || process.env.CLOUDFLARE_API_TOKEN || "",
    apiKey: cf.apiKey || process.env.CLOUDFLARE_API_KEY || "",
    email: cf.email || process.env.CLOUDFLARE_EMAIL || "",
    accountId: cf.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || "",
    zoneId: cf.zoneId || process.env.CLOUDFLARE_ZONE_ID || "",
    tunnelId: cf.tunnelId || process.env.CLOUDFLARE_TUNNEL_ID || "",
    tunnelToken: cf.tunnelToken || process.env.CLOUDFLARE_TUNNEL_TOKEN || process.env.TUNNEL_TOKEN || "",
    tunnelPublicUrl: cf.tunnelPublicUrl || process.env.CLOUDFLARE_TUNNEL_PUBLIC_URL || process.env.CLOUDFLARE_TUNNEL_HOSTNAME || "",
    tunnelOriginUrl: cf.tunnelOriginUrl || process.env.CLOUDFLARE_TUNNEL_ORIGIN_URL || "http://127.0.0.1:1212",
  };
}

function getCloudflareAuthHeaders(config) {
  if (config.apiKey && config.email) {
    return {
      "X-Auth-Key": config.apiKey,
      "X-Auth-Email": config.email,
      "Content-Type": "application/json",
    };
  }
  if (config.apiToken) {
    return {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    };
  }
  return null;
}

async function cloudflareApiRequest(pathname, config, options = {}) {
  const authHeaders = getCloudflareAuthHeaders(config);
  if (!authHeaders) return null;
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {}),
    },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.success === false) {
    const message = payload?.errors?.[0]?.message || `Cloudflare API failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function resolveCloudflareAccountId(config) {
  if (config.accountId) return config.accountId;
  if (!config.zoneId) return "";
  const payload = await cloudflareApiRequest(`/zones/${config.zoneId}`, config);
  return payload?.result?.account?.id || "";
}

function getCloudflareConnectorId(connection) {
  return connection?.id || connection?.uuid || connection?.connector_id || "";
}

function getHostnameFromUrl(url) {
  try {
    return new URL(normalizeUrl(url)).hostname;
  } catch {
    return "";
  }
}

function getCloudflareTunnelCnameTarget(tunnelId) {
  return tunnelId ? `${tunnelId}.cfargotunnel.com` : "";
}

async function ensureCloudflareDnsRecord(config) {
  const hostname = getHostnameFromUrl(config.tunnelPublicUrl);
  const cnameTarget = getCloudflareTunnelCnameTarget(config.tunnelId);
  if (!getCloudflareAuthHeaders(config) || !config.zoneId || !hostname || !cnameTarget) {
    return { skipped: true, reason: "missing_config", requiredPermissions: CLOUDFLARE_DNS_WRITE_PERMISSIONS };
  }

  const recordsPayload = await cloudflareApiRequest(
    `/zones/${config.zoneId}/dns_records?name=${encodeURIComponent(hostname)}`,
    config
  );
  const records = Array.isArray(recordsPayload?.result) ? recordsPayload.result : [];
  const expectedContent = cnameTarget.toLowerCase();
  const existingCname = records.find((record) => (
    record?.type === "CNAME"
    && String(record?.content || "").toLowerCase() === expectedContent
    && record?.proxied === true
  ));

  if (existingCname) {
    return { skipped: false, changed: false, hostname, target: cnameTarget, recordId: existingCname.id };
  }

  let deleted = 0;
  for (const record of records) {
    if (!record?.id) continue;
    await cloudflareApiRequest(`/zones/${config.zoneId}/dns_records/${record.id}`, config, { method: "DELETE" });
    deleted += 1;
  }

  const createPayload = await cloudflareApiRequest(`/zones/${config.zoneId}/dns_records`, config, {
    method: "POST",
    body: JSON.stringify({
      type: "CNAME",
      name: hostname,
      content: cnameTarget,
      ttl: 1,
      proxied: true,
    }),
  });

  return {
    skipped: false,
    changed: true,
    deleted,
    hostname,
    target: cnameTarget,
    recordId: createPayload?.result?.id || "",
    requiredPermissions: CLOUDFLARE_DNS_WRITE_PERMISSIONS,
  };
}

async function pruneCloudflareTunnelConnectors(config) {
  if (!getCloudflareAuthHeaders(config) || !config.tunnelId) return { skipped: true, reason: "missing_config", requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS };
  const accountId = await resolveCloudflareAccountId(config);
  if (!accountId) return { skipped: true, reason: "missing_account_id", requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS, recommendedEnv: "CLOUDFLARE_ACCOUNT_ID" };

  const currentHostname = os.hostname().toLowerCase();
  const payload = await cloudflareApiRequest(`/accounts/${accountId}/cfd_tunnel/${config.tunnelId}/connections`, config);
  const connections = Array.isArray(payload?.result) ? payload.result : [];
  const staleConnections = connections.filter((connection) => {
    const hostname = String(connection?.hostname || connection?.host || "").toLowerCase();
    return hostname && hostname !== currentHostname;
  });

  let deleted = 0;
  for (const connection of staleConnections) {
    const connectorId = getCloudflareConnectorId(connection);
    if (!connectorId) continue;
    await cloudflareApiRequest(
      `/accounts/${accountId}/cfd_tunnel/${config.tunnelId}/connections/${connectorId}`,
      config,
      { method: "DELETE" }
    );
    deleted += 1;
  }

  return { skipped: false, deleted, keptHostname: currentHostname, requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS };
}

async function deleteAllCloudflareTunnelConnectors(config) {
  if (!getCloudflareAuthHeaders(config) || !config.tunnelId) {
    return { skipped: true, reason: "missing_config", requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS };
  }
  const accountId = await resolveCloudflareAccountId(config);
  if (!accountId) {
    return { skipped: true, reason: "missing_account_id", requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS, recommendedEnv: "CLOUDFLARE_ACCOUNT_ID" };
  }

  const payload = await cloudflareApiRequest(`/accounts/${accountId}/cfd_tunnel/${config.tunnelId}/connections`, config);
  const connections = Array.isArray(payload?.result) ? payload.result : [];
  const deleted = connections.reduce((total, connection) => total + (Array.isArray(connection?.conns) ? connection.conns.length : 1), 0);
  await cloudflareApiRequest(
    `/accounts/${accountId}/cfd_tunnel/${config.tunnelId}/connections`,
    config,
    { method: "DELETE" }
  );

  return { skipped: false, deleted, accountId, requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS };
}

function getNamedTunnelPublicUrl(settings = null) {
  return normalizeUrl(getCloudflareRuntimeConfig(settings).tunnelPublicUrl);
}

function getComputedPublicUrl(shortId, settings = null) {
  if (!shortId) return "";
  const namedTunnelPublicUrl = getNamedTunnelPublicUrl(settings);
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

// â”€â”€â”€ Cloudflare Tunnel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  isTunnelEnableInProgress = true;
  const settings = await getSettings();
  const cloudflareConfig = getCloudflareRuntimeConfig(settings);
  createRuntimeBackup(`before-enable-${provider}`);
  manualDisabled = false;
  cachedTunnelStatusAt = 0;
  cachedTunnelStatus = null;
  const namedTunnelPublicUrl = getNamedTunnelPublicUrl(settings);
  const useNamedTunnel = !!cloudflareConfig.tunnelToken;

  try {

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
    if (settings.tunnelEnabled === true && existing?.tunnelUrl) {
      const publicUrl = getComputedPublicUrl(existing.shortId, settings);
      return { success: true, tunnelUrl: existing.tunnelUrl, shortId: existing.shortId, publicUrl, alreadyRunning: true };
    }
  }

  killCloudflared();

  const machineId = getMachineId();
  const existing = loadState();
  const shortId = existing?.shortId || generateShortId();

  if (useNamedTunnel) {
    let cleanupResult = { skipped: true, reason: "not_attempted" };
    let dnsResult = { skipped: true, reason: "not_attempted" };
    try {
      dnsResult = await ensureCloudflareDnsRecord(cloudflareConfig);
      if (!dnsResult.skipped && dnsResult.changed) {
        console.log(`[cloudflare] Updated DNS ${dnsResult.hostname} -> ${dnsResult.target}`);
      }
    } catch (err) {
      dnsResult = { skipped: true, reason: "error", error: err.message, requiredPermissions: CLOUDFLARE_DNS_WRITE_PERMISSIONS };
      console.warn(`[cloudflare] Could not auto-configure DNS record: ${err.message}`);
    }

    try {
      const pruneResult = await pruneCloudflareTunnelConnectors(cloudflareConfig);
      cleanupResult = pruneResult;
      if (!pruneResult.skipped && pruneResult.deleted > 0) {
        console.log(`[cloudflare] Removed ${pruneResult.deleted} stale tunnel connector(s)`);
      }
    } catch (err) {
      cleanupResult = { skipped: true, reason: "error", error: err.message, requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS, recommendedEnv: "CLOUDFLARE_ACCOUNT_ID" };
      console.warn(`[cloudflare] Could not prune stale tunnel connectors: ${err.message}`);
    }

    const originUrl = cloudflareConfig.tunnelOriginUrl || `http://127.0.0.1:${localPort}`;
    let cloudflared = null;
    let lastSpawnError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        cloudflared = await spawnCloudflared(cloudflareConfig.tunnelToken, originUrl);
        if (isCloudflaredRunning()) {
          lastSpawnError = null;
          break;
        }
        lastSpawnError = new Error("cloudflared not running after startup");
      } catch (error) {
        lastSpawnError = error;
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    if (lastSpawnError) {
      throw lastSpawnError;
    }

    try {
      const pruneResult = await pruneCloudflareTunnelConnectors(cloudflareConfig);
      if (!pruneResult.skipped) {
        cleanupResult = pruneResult;
      }
      if (!pruneResult.skipped && pruneResult.deleted > 0) {
        console.log(`[cloudflare] Removed ${pruneResult.deleted} stale tunnel connector(s) after connect`);
      }
    } catch (err) {
      if (cleanupResult.skipped) {
        cleanupResult = { skipped: true, reason: "error", error: err.message, requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS, recommendedEnv: "CLOUDFLARE_ACCOUNT_ID" };
      }
      console.warn(`[cloudflare] Could not prune stale tunnel connectors after connect: ${err.message}`);
    }
    lastConnectorCleanupResult = cleanupResult;
    const tunnelUrl = namedTunnelPublicUrl || existing?.tunnelUrl || "";
    saveState({ shortId, machineId, tunnelUrl });
    await updateSettings({
      tunnelEnabled: true,
      tunnelUrl,
      tunnelProvider: "cloudflare",
      cloudflareServiceInstalled: !!cloudflared?.serviceInstalled,
    });

    if (!exitHandlerRegistered) {
      setUnexpectedExitHandler(() => {
        if (!isReconnecting) scheduleReconnect(0);
      });
      exitHandlerRegistered = true;
    }

    return {
      success: true,
      tunnelUrl,
      shortId,
      publicUrl: getComputedPublicUrl(shortId, settings),
      mode: "named",
      serviceInstalled: !!cloudflared?.serviceInstalled,
      dnsSetup: dnsResult,
      connectorCleanup: cleanupResult
    };
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

  const publicUrl = getComputedPublicUrl(shortId, settings);
  return { success: true, tunnelUrl, shortId, publicUrl, provider: "cloudflare" };
  } finally {
    isTunnelEnableInProgress = false;
  }
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
  isTunnelEnableInProgress = false;
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

  await updateSettings({ tunnelEnabled: false, tunnelUrl: "" });
  isReconnecting = false;
  return { success: true };
}

export async function forceResetCloudflareTunnel(localPort = 1212) {
  createRuntimeBackup("before-force-reset-cloudflare");
  manualDisabled = false;
  isReconnecting = false;
  isTunnelEnableInProgress = false;
  cachedTunnelStatusAt = 0;
  cachedTunnelStatus = null;

  const settings = await getSettings();
  const cloudflareConfig = getCloudflareRuntimeConfig(settings);
  let connectorReset = { skipped: true, reason: "not_attempted" };

  killCloudflared();
  killNgrok();

  try {
    connectorReset = await deleteAllCloudflareTunnelConnectors(cloudflareConfig);
    if (!connectorReset.skipped) {
      console.log(`[cloudflare] Force reset deleted ${connectorReset.deleted} tunnel connector(s)`);
    }
  } catch (err) {
    connectorReset = {
      skipped: true,
      reason: "error",
      error: err.message,
      requiredPermissions: CLOUDFLARE_CONNECTOR_WRITE_PERMISSIONS,
      recommendedEnv: "CLOUDFLARE_ACCOUNT_ID",
    };
    console.warn(`[cloudflare] Force reset could not delete tunnel connectors: ${err.message}`);
  }

  const enabled = await enableTunnel(localPort, "cloudflare");
  return {
    ...enabled,
    connectorReset,
  };
}

export async function getTunnelStatus(settingsOverride) {
  const state = loadState();
  const settings = settingsOverride || await getSettings();
  const shortId = state?.shortId || "";
  const publicUrl = getComputedPublicUrl(shortId, settings);

  if (settings.tunnelEnabled !== true) {
    if (isTunnelEnableInProgress) {
      const provider = settings.tunnelProvider || "cloudflare";
      const running = provider === "ngrok" ? isNgrokRunning() : isCloudflaredRunning();
      return {
        enabled: running,
        tunnelUrl: settings.tunnelUrl || state?.tunnelUrl || "",
        shortId,
        publicUrl: settings.tunnelUrl || publicUrl,
        running,
        provider,
        serviceInstalled: provider === "cloudflare" ? isCloudflaredServiceInstalled() : false,
        starting: true,
        connectorCleanup: provider === "cloudflare" ? lastConnectorCleanupResult : null,
      };
    }

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
      provider: settings.tunnelProvider || "cloudflare",
      serviceInstalled: settings.cloudflareServiceInstalled === true,
    };
  }

  if (shouldUseCachedStatus(cachedTunnelStatusAt)) {
    return {
      ...cachedTunnelStatus,
      enabled: settings.tunnelEnabled === true && cachedTunnelStatus.running,
      tunnelUrl: settings.tunnelUrl || state?.tunnelUrl || cachedTunnelStatus.tunnelUrl || "",
      provider: cachedTunnelStatus.provider || settings.tunnelProvider || "cloudflare",
      shortId,
      publicUrl,
      serviceInstalled: settings.cloudflareServiceInstalled === true,
    };
  }

  const provider = settings.tunnelProvider || "cloudflare";
  const running = provider === "ngrok" ? isNgrokRunning() : isCloudflaredRunning();
  const serviceInstalled = provider === "cloudflare" ? isCloudflaredServiceInstalled() : false;

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

  if (provider === "cloudflare" && settings.cloudflareServiceInstalled !== serviceInstalled) {
    await updateSettings({ cloudflareServiceInstalled: serviceInstalled });
  }

  return {
    enabled: settings.tunnelEnabled === true && running,
    tunnelUrl: settings.tunnelUrl || tunnelUrl,
    shortId,
    publicUrl: settings.tunnelUrl || publicUrl,
    running,
    provider,
    serviceInstalled,
    connectorCleanup: provider === "cloudflare" ? lastConnectorCleanupResult : null,
  };
}

export async function getTunnelProviderStatuses(settingsOverride) {
  const settings = settingsOverride || await getSettings();
  const state = loadState();

  const cloudflareRunning = isCloudflaredRunning();
  const ngrokRunning = isNgrokRunning();

  const namedTunnelPublicUrl = getNamedTunnelPublicUrl(settings);
  const settingsTunnelUrl = settings?.tunnelUrl || "";
  const stateTunnelUrl = state?.tunnelUrl || "";

  const cloudflareUrl =
    namedTunnelPublicUrl ||
    (!isNgrokUrl(settingsTunnelUrl) ? settingsTunnelUrl : "") ||
    (!isNgrokUrl(stateTunnelUrl) ? stateTunnelUrl : "");

  const resolvedNgrokUrl = ngrokRunning ? await resolveNgrokPublicUrl() : "";
  const ngrokUrl =
    resolvedNgrokUrl ||
    (isNgrokUrl(settingsTunnelUrl) ? settingsTunnelUrl : "") ||
    (isNgrokUrl(stateTunnelUrl) ? stateTunnelUrl : "");

  // Resolve stale provider state:
  // - If current tunnel URL is clearly Cloudflare/non-ngrok and cloudflared is running,
  //   force Cloudflare active and keep Ngrok inactive even if settings.tunnelProvider is stale.
  // - If ngrok URL is detected (via ngrok API or ngrok-pattern URL), allow Ngrok active.
  const hasCloudflareUrl = !!cloudflareUrl;
  const hasNgrokUrl = !!ngrokUrl;
  const settingSaysNgrok = settings.tunnelProvider === "ngrok";
  const settingSaysCloudflare = settings.tunnelProvider === "cloudflare";

  const forceCloudflare = hasCloudflareUrl && cloudflareRunning && (!hasNgrokUrl || !ngrokRunning);
  const effectiveCloudflareEnabled = settings.tunnelEnabled === true && (settingSaysCloudflare || forceCloudflare) && cloudflareRunning && hasCloudflareUrl;
  const effectiveNgrokEnabled = settings.tunnelEnabled === true && !forceCloudflare && settingSaysNgrok && ngrokRunning && hasNgrokUrl;

  return {
    cloudflare: {
      enabled: effectiveCloudflareEnabled,
      running: cloudflareRunning,
      tunnelUrl: cloudflareUrl,
      publicUrl: cloudflareUrl,
      serviceInstalled: isCloudflaredServiceInstalled(),
      connectorCleanup: lastConnectorCleanupResult,
    },
    ngrok: {
      enabled: effectiveNgrokEnabled,
      running: ngrokRunning,
      tunnelUrl: effectiveNgrokEnabled ? ngrokUrl : "",
      publicUrl: effectiveNgrokEnabled ? ngrokUrl : "",
    },
  };
}

// â”€â”€â”€ Tailscale Funnel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // Funnel not enabled on tailnet â€” return enable URL
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
