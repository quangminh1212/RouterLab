import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAuthSecret } from "@/lib/auth/sessionSecret";
import { getEffectiveUsername, hasStoredCredentials, setCredentials, verifyCredentials } from "@/lib/auth/credentials";

const SECRET = getAuthSecret();

function isLocalhostRequest(request) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
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

async function canManageCredentials(request) {
  return isLocalhostRequest(request) || await hasValidToken();
}

export async function GET(request) {
  try {
    if (!(await canManageCredentials(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      username: await getEffectiveUsername(),
      hasCustomCredentials: await hasStoredCredentials(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Không tải được tài khoản" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (isCrossSiteUnsafeRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await canManageCredentials(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const currentUsername = String(body?.currentUsername || "").trim();
    const currentPassword = String(body?.currentPassword || "");
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    const currentOk = await verifyCredentials(currentUsername, currentPassword);
    if (!currentOk) {
      return NextResponse.json({ error: "Tài khoản hoặc mật khẩu hiện tại không đúng" }, { status: 401 });
    }

    const updated = await setCredentials({ username, password });
    return NextResponse.json({ success: true, username: updated.username });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Không đổi được tài khoản" }, { status: 400 });
  }
}
