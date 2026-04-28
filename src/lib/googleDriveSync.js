import { cookies } from "next/headers";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const BACKUP_FILE_NAME = "xlabrouter-backup.json";
const APPDATA_SPACE = "appDataFolder";
const SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.appdata",
].join(" ");

function getBaseUrl(request) {
  return process.env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
}

export function getGoogleAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  };
}

export function isGoogleAuthConfigured() {
  const { clientId, clientSecret } = getGoogleAuthConfig();
  return !!clientId && !!clientSecret;
}

export function buildGoogleRedirectUri(request) {
  return `${getBaseUrl(request)}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(request, state = "") {
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
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleCode(request, code) {
  const { clientId, clientSecret } = getGoogleAuthConfig();
  const redirectUri = buildGoogleRedirectUri(request);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
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
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
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

export async function findDriveBackupFile(accessToken) {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and '${APPDATA_SPACE}' in parents and trashed=false`);
  const url = `${GOOGLE_DRIVE_FILES_URL}?spaces=${APPDATA_SPACE}&fields=files(id,name,modifiedTime,size)&q=${query}`;
  const response = await driveRequest(accessToken, url, { method: "GET" });
  const data = await response.json().catch(() => ({ files: [] }));
  return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
}

export async function downloadDriveBackup(accessToken, fileId) {
  const response = await driveRequest(accessToken, `${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`, { method: "GET" });
  return response.json();
}

export async function uploadDriveBackup(accessToken, payload, existingFileId = "") {
  const metadata = existingFileId
    ? null
    : { name: BACKUP_FILE_NAME, parents: [APPDATA_SPACE], mimeType: "application/json" };
  const multipartBoundary = `xlabrouter-${Date.now()}`;
  const bodyParts = [];
  if (metadata) {
    bodyParts.push(`--${multipartBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
  }
  bodyParts.push(`--${multipartBoundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n--${multipartBoundary}--`);
  const uploadUrl = existingFileId
    ? `${GOOGLE_DRIVE_UPLOAD_URL}/${existingFileId}?uploadType=media`
    : `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart`;
  const response = await driveRequest(accessToken, uploadUrl, {
    method: existingFileId ? "PATCH" : "POST",
    headers: {
      "Content-Type": existingFileId ? "application/json" : `multipart/related; boundary=${multipartBoundary}`,
    },
    body: existingFileId ? JSON.stringify(payload) : bodyParts.join(""),
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
  const common = { httpOnly: true, secure, sameSite: "lax", path: "/" };
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
