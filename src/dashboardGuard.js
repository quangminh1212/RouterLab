import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSettings } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "xlabrouter-default-secret-change-me"
);

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";

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
  "/api/providers/client",
  "/api/provider-nodes/validate",
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

// Read settings directly from DB to avoid self-fetch deadlock in proxy
let cachedSettings = null;
let cachedSettingsAt = 0;

function getSettingsCacheTtlMs() {
  const raw = Number(process.env.GUARD_SETTINGS_CACHE_MS);
  if (!Number.isFinite(raw) || raw < 0) return 60000; // was 5000ms — now 60s to reduce middleware lock contention
  return raw;
}

async function loadSettings() {
  const now = Date.now();
  const cacheHit = cachedSettings && now - cachedSettingsAt < getSettingsCacheTtlMs();

  if (cacheHit) {
    if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
      console.log("[DASHBOARD_GUARD] loadSettings:cacheHit", { age: now - cachedSettingsAt });
    }
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
  if (await hasValidToken(request)) return true;
  const settings = await loadSettings();
  if (settings && settings.requireLogin === false) return true;
  return false;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const start = Date.now();

  // Always protected - require valid JWT or local CLI token (machineId-based)
  if (ALWAYS_PROTECTED.some((p) => pathname.startsWith(p))) {
    const decision = await hasValidCliToken(request) || await hasValidToken(request) ? "allow" : "deny";
    if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
      console.log("[DASHBOARD_GUARD] proxy:alwaysProtected", { pathname, decision, durationMs: Date.now() - start });
    }
    if (decision === "allow") return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect sensitive API endpoints (allow CLI token, JWT, or requireLogin=false)
  if (PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))) {
    if (pathname === "/api/settings/require-login") return NextResponse.next();
    const decision = await hasValidCliToken(request) || await isAuthenticated(request) ? "allow" : "deny";
    if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
      console.log("[DASHBOARD_GUARD] proxy:protectedApi", { pathname, decision, durationMs: Date.now() - start });
    }
    if (decision === "allow") return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect all dashboard routes
  if (pathname.startsWith("/dashboard")) {
    let requireLogin = true;
    let tunnelDashboardAccess = true;

    try {
      const settings = await loadSettings();
      if (settings) {
        requireLogin = settings.requireLogin !== false;
        tunnelDashboardAccess = settings.tunnelDashboardAccess === true;

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
    if (!requireLogin) {
      if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
        console.log("[DASHBOARD_GUARD] proxy:dashboard:noLoginRequired", { pathname, durationMs: Date.now() - start });
      }
      return NextResponse.next();
    }

    // Verify JWT token
    const token = request.cookies.get("auth_token")?.value;
    if (token) {
      try {
        await jwtVerify(token, SECRET);
        if (process.env.DEBUG_DASHBOARD_PERF_VERBOSE === "true") {
          console.log("[DASHBOARD_GUARD] proxy:dashboard:tokenValid", { pathname, durationMs: Date.now() - start });
        }
        return NextResponse.next();
      } catch {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect / to /dashboard if logged in, or /dashboard if it's the root
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
