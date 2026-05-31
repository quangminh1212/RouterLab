import { NextResponse } from "next/server";

import { SignJWT } from "jose";

import { getAuthSecret } from "@/lib/auth/sessionSecret";

import { verifyCredentials } from "@/lib/auth/credentials";

import { cookies } from "next/headers";



const SECRET = getAuthSecret();

const AUTH_SESSION_MAX_AGE_SECONDS = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 90);



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



    const ok = await verifyCredentials(username, password);

    if (!ok) {

      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" }, { status: 401 });

    }



    const token = await new SignJWT({ authenticated: true, provider: "password", sub: username })

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



