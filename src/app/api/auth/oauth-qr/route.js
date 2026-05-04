import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getAuthSecret } from "@/lib/auth/sessionSecret";
import { getOrCreateTotpSecret, buildTotpUri, verifyTotpCode } from "@/lib/auth/totp";

const SECRET = getAuthSecret();
const AUTH_SESSION_MAX_AGE_SECONDS = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 90);

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

async function setAuthCookie() {
  const token = await new SignJWT({ authenticated: true, provider: "totp" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${AUTH_SESSION_MAX_AGE_SECONDS}s`)
    .sign(SECRET);
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  });
}

export async function GET() {
  try {
    const secret = await getOrCreateTotpSecret();
    return NextResponse.json({
      mode: "totp",
      secret,
      url: buildTotpUri(secret),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load OAuth QR" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (action === "rotate") {
      if (!isLocalhostRequest(request) && !(await hasValidToken())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const secret = await getOrCreateTotpSecret({ rotate: true });
      return NextResponse.json({ success: true, mode: "totp", secret, url: buildTotpUri(secret) });
    }

    if (action === "verify") {
      const code = typeof body?.code === "string" ? body.code : "";
      const secret = await getOrCreateTotpSecret();
      if (!verifyTotpCode(secret, code)) {
        return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
      }
      await setAuthCookie();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Authenticator request failed" }, { status: 500 });
  }
}

