import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSettings, updateSettings } from "@/lib/localDb";
import { getAuthSecret } from "@/lib/auth/sessionSecret";
import { buildGoogleAuthUrl, createPkceChallenge, createPkceVerifier } from "@/lib/googleDriveSync";

const SECRET = getAuthSecret();

function createOAuthQrToken() {
  return randomBytes(18).toString("base64url");
}

function isLocalhostRequest(request) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function hasValidToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateOAuthQrToken({ rotate = false } = {}) {
  const settings = await getSettings();
  const existing = typeof settings.oauthQrToken === "string" ? settings.oauthQrToken.trim() : "";
  const existingVerifier = typeof settings.oauthQrCodeVerifier === "string" ? settings.oauthQrCodeVerifier.trim() : "";
  const shouldRotate = rotate || !existing || !existingVerifier;
  const token = shouldRotate ? createOAuthQrToken() : existing;
  const codeVerifier = shouldRotate ? createPkceVerifier() : existingVerifier;
  if (token !== existing) {
    await updateSettings({ oauthQrToken: token, oauthQrCodeVerifier: codeVerifier, oauthQrRotatedAt: new Date().toISOString() });
  }
  return { token, codeVerifier };
}

function buildOAuthQrUrl(request, token, codeVerifier) {
  const codeChallenge = createPkceChallenge(codeVerifier);
  return buildGoogleAuthUrl(request, token, codeChallenge);
}

export async function GET(request) {
  try {
    const { token, codeVerifier } = await getOrCreateOAuthQrToken();
    return NextResponse.json({ token, url: buildOAuthQrUrl(request, token, codeVerifier) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load OAuth QR" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isLocalhostRequest(request) && !(await hasValidToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.action !== "rotate") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    const { token, codeVerifier } = await getOrCreateOAuthQrToken({ rotate: true });
    return NextResponse.json({ success: true, token, url: buildOAuthQrUrl(request, token, codeVerifier) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to rotate OAuth QR" }, { status: 500 });
  }
}
