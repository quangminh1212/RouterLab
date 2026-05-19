import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSettings } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { getAuthSecret } from "@/lib/auth/sessionSecret";

const SECRET = getAuthSecret();

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";
const AUTH_DISABLED = false;

let cachedCliToken = null;
async function getCliToken() {
  if (!cachedCliToken) cachedCliToken = await getConsistentMachineId(CLI_TOKEN_SALT);
  return cachedCliToken;
}

async function hasValidCliToken(request) {
  const token = request.headers.get(CLI_TOKEN_HEADER);
  if (!token) return false;
  return token === await getCliToken();
}

// Always require JWT token regardless of requireLogin setting
const ALWAYS_PROTECTED = [
  "/api/shutdown",
  "/api/settings/database",
];

// Require auth, but allow through if requireLogin is disabled
const PROTECTED_API_PATHS = [
  "/api/settings",
  "/api/keys",
  "/api/cli-tools",
  "/api/tunnel",
  "/api/proxy-pools",
  "/api/providers",
  "/api/provider-nodes",
  "/api/combos",
  "/api/basic-chat/state",
  "/api/usage",
  "/api/dashboard/bootstrap",
  "/api/providers/client",
  "/api/provider-nodes/validate",
  "/api/debug",
];

async function hasValidToken(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

function isLocalhostRequest(request) {
  const normalizeHost = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "::1" || raw === "[::1]") return "::1";
    if (raw.startsWith("[::1]:")) return "::1";
    return raw.split(":")[0];
  };

  const hostValues = [
    request.nextUrl?.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
  ];

  return hostValues.some((value) => {
    const host = normalizeHost(value);
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  });
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

function parseHostnameFromUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isTunnelLikeRequest(request, settings) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") return false;

  const tunnelHost = parseHostnameFromUrl(settings?.tunnelUrl || "");
  const tailscaleHost = parseHostnameFromUrl(settings?.tailscaleUrl || "");
  if ((tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost)) return true;

  const cfDomain = String(settings?.cloudflare?.domain || "").trim().toLowerCase();
  if (cfDomain && (host === cfDomain || host.endsWith(`.${cfDomain}`))) return true;

  return false;
}

// Read settings directly from DB to avoid self-fetch deadlock in proxy
let cachedSettings = null;
let cachedSettingsAt = 0;

function getSettingsCacheTtlMs() {
  const raw = Number(process.env.GUARD_SETTINGS_CACHE_MS);
  if (!Number.isFinite(raw) || raw < 0) return 60000;
  return raw;
}

async function loadSettings() {
  const now = Date.now();
  const cacheHit = cachedSettings && now - cachedSettingsAt < getSettingsCacheTtlMs();

  if (cacheHit) {
    return cachedSettings;
  }

  const start = Date.now();
  try {
    const settings = await getSettings();
    cachedSettings = settings;
    cachedSettingsAt = now;
    const durationMs = Date.now() - start;
    if (durationMs > 100 || process.env.DEBUG_DASHBOARD_PERF === "true") {
      console.log("[DASHBOARD_GUARD] loadSettings:cacheMiss", { durationMs });
    }
    return settings;
  } catch {
    return null;
  }
}

async function isAuthenticated(request) {
  if (AUTH_DISABLED) return true;
  if (isLocalhostRequest(request)) return true;
  if (await hasValidToken(request)) return true;
  const settings = await loadSettings();
  if (isTunnelLikeRequest(request, settings)) return false;
  if (settings && settings.requireLogin === false) return true;
  return false;
}

function addSecurityHeaders(response) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const start = Date.now();

  if (AUTH_DISABLED && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isCrossSiteUnsafeRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Always protected - require valid JWT or local CLI token (machineId-based)
  if (ALWAYS_PROTECTED.some((p) => pathname.startsWith(p))) {
    const decision = isLocalhostRequest(request) || await hasValidCliToken(request) || await hasValidToken(request) ? "allow" : "deny";
    if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
      console.log("[DASHBOARD_GUARD] proxy:alwaysProtected", { pathname, decision, durationMs: Date.now() - start });
    }
    if (decision === "allow") return addSecurityHeaders(NextResponse.next());
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect sensitive API endpoints (allow CLI token, JWT, or requireLogin=false)
  if (PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))) {
    if (pathname === "/api/settings/require-login") return addSecurityHeaders(NextResponse.next());
    if (isLocalhostRequest(request)) return addSecurityHeaders(NextResponse.next());
    const settings = await loadSettings();
    const tunnelLike = isTunnelLikeRequest(request, settings);
    if (tunnelLike && !(await hasValidCliToken(request)) && !(await hasValidToken(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decision = await hasValidCliToken(request) || await isAuthenticated(request) ? "allow" : "deny";
    if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
      console.log("[DASHBOARD_GUARD] proxy:protectedApi", { pathname, decision, durationMs: Date.now() - start });
    }
    if (decision === "allow") return addSecurityHeaders(NextResponse.next());
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect all dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (AUTH_DISABLED) {
      return addSecurityHeaders(NextResponse.next());
    }

    if (isLocalhostRequest(request)) {
      return addSecurityHeaders(NextResponse.next());
    }

    let requireLogin = true;
    let tunnelDashboardAccess = true;
    let tunnelLike = false;

    try {
      const settings = await loadSettings();
      if (settings) {
        requireLogin = settings.requireLogin !== false;
        tunnelDashboardAccess = settings.tunnelDashboardAccess === true;
        tunnelLike = isTunnelLikeRequest(request, settings);

        // Block tunnel/tailscale access if disabled (redirect to login)
        if (!tunnelDashboardAccess) {
          const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
          const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
          const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
          if ((tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost)) {
            return NextResponse.redirect(new URL("/login", request.url));
          }
        }
      }
    } catch {
      // On error, keep defaults (require login, block tunnel)
    }

    // If login not required, allow through
    if (!requireLogin && !tunnelLike) {
      if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
        console.log("[DASHBOARD_GUARD] proxy:dashboard:noLoginRequired", { pathname, durationMs: Date.now() - start });
      }
      return addSecurityHeaders(NextResponse.next());
    }

    // Verify JWT token
    const token = request.cookies.get("auth_token")?.value;
    if (token) {
      try {
        await jwtVerify(token, SECRET);
        if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
          console.log("[DASHBOARD_GUARD] proxy:dashboard:tokenValid", { pathname, durationMs: Date.now() - start });
        }
        return addSecurityHeaders(NextResponse.next());
      } catch {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect / to /dashboard if logged in, or /dashboard if it\'s the root
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/api/settings/:path*",
    "/api/keys/:path*",
    "/api/cli-tools/:path*",
    "/api/tunnel/:path*",
    "/api/proxy-pools/:path*",
    "/api/providers/:path*",
    "/api/provider-nodes/:path*",
    "/api/combos/:path*",
    "/api/basic-chat/state",
    "/api/usage/:path*",
    "/api/dashboard/bootstrap",
    "/api/debug/:path*",
    "/api/shutdown",
  ],
};



