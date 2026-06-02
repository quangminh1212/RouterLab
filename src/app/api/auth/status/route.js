import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

import { getAuthSecret } from "@/lib/auth/sessionSecret";
import { getSettings } from "@/lib/localDb";
import { hasStoredCredentials } from "@/lib/auth/credentials";

const SECRET = getAuthSecret();

async function readSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload?.authenticated) return null;
    return payload;
  } catch {
    return null;
  }
}

function readAuthToken(request) {
  const nextCookieToken = request?.cookies?.get?.("auth_token")?.value;
  if (nextCookieToken) return nextCookieToken;

  const cookieHeader = request?.headers?.get?.("cookie") || "";
  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rest] = entry.split("=");
    if (String(rawName || "").trim() !== "auth_token") continue;
    const value = rest.join("=").trim();
    if (!value) return "";
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return "";
}
function buildDisplayName(session) {
  if (!session) return "Guest";
  const provider = String(session.provider || "").trim();
  const subject = String(session.sub || "").trim();
  if (provider === "oauth-qr") return "OAuth QR user";
  if (subject) return subject;
  return provider ? `${provider} user` : "Authenticated user";
}

export async function GET(request) {
  try {
    const settings = await getSettings();
    const session = await readSession(readAuthToken(request));
    const requireLogin = settings.requireLogin !== false;
    const provider = String(session?.provider || "").trim();
    const loginMethod = provider === "oauth-qr" ? "OAuth QR" : provider === "password" ? "Password" : "None";

    return NextResponse.json({
      requireLogin,
      authMode: "oauth-qr",
      authenticated: !!session,
      hasPassword: await hasStoredCredentials(),
      displayName: buildDisplayName(session),
      loginMethod,
      oidcConfigured: false,
      oidcLoginLabel: "Sign in with OIDC",
      oidcName: null,
      oidcEmail: null,
      oidcLogin: false,
    });
  } catch {
    return NextResponse.json({
      requireLogin: true,
      authMode: "oauth-qr",
      authenticated: false,
      hasPassword: false,
      displayName: "Guest",
      loginMethod: "None",
      oidcConfigured: false,
      oidcLoginLabel: "Sign in with OIDC",
      oidcName: null,
      oidcEmail: null,
      oidcLogin: false,
    });
  }
}
