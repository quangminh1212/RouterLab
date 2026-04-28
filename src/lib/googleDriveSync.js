import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cookies } from "next/headers";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const BACKUP_FILE_NAME = "xlabrouter-backup.json";
const BACKUP_FOLDER_NAME = "XLab Router Backup";
const GOOGLE_SESSION_MAX_AGE_SECONDS = Number(process.env.GOOGLE_SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 90);
const SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");
const XLAB_WEB_DIR = process.env.XLAB_WEB_DIR || "C:\\Dev\\XLab_Web";
const XLAB_WEB_ENV_FILES = [".env.local", ".env"];

function getBaseUrl(request) {
  const url = new URL(request.url);
  return process.env.GOOGLE_DESKTOP_REDIRECT_ORIGIN || `${url.protocol}//${url.host}`;
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createPkceVerifier() {
  return toBase64Url(randomBytes(64));
}

export function createPkceChallenge(verifier) {
  const hash = createHash("sha256").update(verifier).digest();
  return toBase64Url(hash);
}

function escapeQuery(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function readEnvValue(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m"));
  if (!match) return "";
  return match[1].replace(/^['"]|['"]$/g, "").trim();
}

function readXLabWebGoogleAuthConfig() {
  for (const fileName of XLAB_WEB_ENV_FILES) {
    const filePath = `${XLAB_WEB_DIR}\\${fileName}`;
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, "utf8");
      const clientId = readEnvValue(content, "GOOGLE_CLIENT_ID");
      const clientSecret = readEnvValue(content, "GOOGLE_CLIENT_SECRET");
      if (clientId) return { clientId, clientSecret };
    } catch {}
  }
  return { clientId: "", clientSecret: "" };
}

export function getGoogleAuthConfig() {
  const localClientId = process.env.GOOGLE_DESKTOP_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
  const localClientSecret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
  if (localClientId) return { clientId: localClientId, clientSecret: localClientSecret, source: "local" };

  const xlabWebConfig = readXLabWebGoogleAuthConfig();
  return {
    clientId: xlabWebConfig.clientId,
    clientSecret: xlabWebConfig.clientSecret,
    source: xlabWebConfig.clientId ? "xlab-web" : "none",
  };
}

export function isGoogleAuthConfigured() {
  const { clientId } = getGoogleAuthConfig();
  return !!clientId;
}

export function buildGoogleRedirectUri(request) {
  const config = getGoogleAuthConfig();
  const defaultPath = config.source === "xlab-web" ? "/api/auth/callback/google" : "/api/auth/google/callback";
  const callbackPath = process.env.GOOGLE_REDIRECT_PATH || defaultPath;
  return `${getBaseUrl(request)}${callbackPath}`;
}

export function buildGoogleAuthUrl(request, state = "", codeChallenge = "") {
  const { clientId } = getGoogleAuthConfig();
  const redirectUri = buildGoogleRedirectUri(request);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPE,
  });
  if (state) params.set("state", state);
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleCode(request, code, codeVerifier = "") {
  const { clientId, clientSecret } = getGoogleAuthConfig();
  const redirectUri = buildGoogleRedirectUri(request);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  if (codeVerifier) body.set("code_verifier", codeVerifier);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.error || "Failed to exchange Google code");
  return data;
}

export async function refreshGoogleAccessToken(refreshToken) {
  const { clientId, clientSecret } = getGoogleAuthConfig();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    grant_type: "refresh_token",
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.error || "Failed to refresh Google token");
  return data;
}

export async function fetchGoogleProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Failed to fetch Google profile");
  return data;
}

async function driveRequest(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Google Drive request failed");
  }
  return response;
}

async function findDriveBackupFolder(accessToken) {
  const query = encodeURIComponent(
    `name='${escapeQuery(BACKUP_FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const url = `${GOOGLE_DRIVE_FILES_URL}?fields=files(id,name,modifiedTime)&q=${query}`;
  const response = await driveRequest(accessToken, url, { method: "GET" });
  const data = await response.json().catch(() => ({ files: [] }));
  return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
}

async function ensureDriveBackupFolder(accessToken) {
  const existing = await findDriveBackupFolder(accessToken);
  if (existing?.id) return existing;

  const response = await driveRequest(accessToken, GOOGLE_DRIVE_FILES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  return response.json().catch(() => ({}));
}

export async function findDriveBackupFile(accessToken) {
  const folder = await findDriveBackupFolder(accessToken);
  if (!folder?.id) return null;

  const query = encodeURIComponent(`name='${escapeQuery(BACKUP_FILE_NAME)}' and '${folder.id}' in parents and trashed=false`);
  const url = `${GOOGLE_DRIVE_FILES_URL}?fields=files(id,name,modifiedTime,size)&q=${query}`;
  const response = await driveRequest(accessToken, url, { method: "GET" });
  const data = await response.json().catch(() => ({ files: [] }));
  return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
}

export async function downloadDriveBackup(accessToken, fileId) {
  const response = await driveRequest(accessToken, `${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`, { method: "GET" });
  return response.json();
}

export async function uploadDriveBackup(accessToken, payload, existingFileId = "") {
  if (existingFileId) {
    const response = await driveRequest(accessToken, `${GOOGLE_DRIVE_UPLOAD_URL}/${existingFileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return response.json().catch(() => ({}));
  }

  const folder = await ensureDriveBackupFolder(accessToken);
  if (!folder?.id) throw new Error("Failed to create Google Drive backup folder");

  const metadata = { name: BACKUP_FILE_NAME, parents: [folder.id], mimeType: "application/json" };
  const multipartBoundary = `xlabrouter-${Date.now()}`;
  const bodyParts = [
    `--${multipartBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${multipartBoundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n--${multipartBoundary}--`,
  ];

  const response = await driveRequest(accessToken, `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${multipartBoundary}`,
    },
    body: bodyParts.join(""),
  });
  return response.json().catch(() => ({}));
}

export async function getGoogleSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token")?.value || "";
  const refreshToken = cookieStore.get("google_refresh_token")?.value || "";
  const email = cookieStore.get("google_email")?.value || "";
  const expiresAt = Number(cookieStore.get("google_access_expires_at")?.value || 0);
  return { accessToken, refreshToken, email, expiresAt };
}

export async function setGoogleSession(session) {
  const cookieStore = await cookies();
  const secure = process.env.AUTH_COOKIE_SECURE === "true";
  const common = { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: GOOGLE_SESSION_MAX_AGE_SECONDS };
  cookieStore.set("google_access_token", session.accessToken || "", common);
  cookieStore.set("google_refresh_token", session.refreshToken || "", common);
  cookieStore.set("google_email", session.email || "", common);
  cookieStore.set("google_access_expires_at", String(session.expiresAt || 0), common);
}

export async function clearGoogleSession() {
  const cookieStore = await cookies();
  cookieStore.delete("google_access_token");
  cookieStore.delete("google_refresh_token");
  cookieStore.delete("google_email");
  cookieStore.delete("google_access_expires_at");
}

export async function getValidGoogleAccessToken() {
  const session = await getGoogleSession();
  const now = Date.now();
  if (session.accessToken && session.expiresAt && session.expiresAt - now > 60_000) {
    return { accessToken: session.accessToken, email: session.email };
  }
  if (!session.refreshToken) {
    throw new Error("Google session not connected");
  }
  const refreshed = await refreshGoogleAccessToken(session.refreshToken);
  const nextSession = {
    accessToken: refreshed.access_token,
    refreshToken: session.refreshToken,
    email: session.email,
    expiresAt: now + (Number(refreshed.expires_in || 3600) * 1000),
  };
  await setGoogleSession(nextSession);
  return { accessToken: nextSession.accessToken, email: nextSession.email };
}

export function hasMeaningfulBackupData(bundle) {
  const db = bundle?.database || {};
  return Boolean(
    (Array.isArray(db.providerConnections) && db.providerConnections.length > 0) ||
    (Array.isArray(db.apiKeys) && db.apiKeys.length > 0) ||
    (Array.isArray(db.combos) && db.combos.length > 0) ||
    (db.modelAliases && Object.keys(db.modelAliases).length > 0) ||
    (db.pricing && Object.keys(db.pricing).length > 0)
  );
}
