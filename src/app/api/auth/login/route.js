import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import crypto from "node:crypto";
import { getAuthSecret } from "@/lib/auth/sessionSecret";
import { cookies } from "next/headers";

const SECRET = getAuthSecret();
const AUTH_SESSION_MAX_AGE_SECONDS = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 90);

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || process.env.INITIAL_PASSWORD || "123456";
  return { username, password };
}

function constantTimeEqual(value, expected) {
  const valueHash = crypto.createHash("sha256").update(String(value)).digest();
  const expectedHash = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(valueHash, expectedHash);
}

function isCrossSiteUnsafeRequest(request) {
  const method = (request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  const secFetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (secFetchSite === "cross-site") return true;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || "";
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() !== host.toLowerCase();
  } catch {
    return true;
  }
}

export async function POST(request) {
  const startedAt = Date.now();
  try {
    if (isCrossSiteUnsafeRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    const creds = getAdminCredentials();
    const usernameMatch = constantTimeEqual(username, creds.username);
    const passwordMatch = constantTimeEqual(password, creds.password);

    if (!usernameMatch || !passwordMatch) {
      return NextResponse.json({ error: "Ten dang nhap hoac mat khau khong dung" }, { status: 401 });
    }

    const token = await new SignJWT({ authenticated: true, provider: "password" })
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

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 100) {
      console.log(`[PERF] POST /api/auth/login took ${durationMs}ms`);
    }
  }
}
