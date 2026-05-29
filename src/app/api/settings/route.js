import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import { getComboPerformanceSnapshot, resetComboRotation } from "open-sse/services/combo.js";

function sanitizeSettings(settings) {
  const { password, adminAuth, ...safeSettings } = settings || {};
  if (adminAuth && typeof adminAuth === "object") {
    safeSettings.adminAuth = {
      username: adminAuth.username || "admin",
      hasCustomCredentials: Boolean(adminAuth.passwordHash),
    };
  }
  if (safeSettings.gistBackup && typeof safeSettings.gistBackup === "object") {
    safeSettings.gistBackup = {
      ...safeSettings.gistBackup,
      token: safeSettings.gistBackup.token ? "***" : "",
    };
  }
  return safeSettings;
}

export async function GET() {
  const startedAt = Date.now();
  try {
    const settings = await getSettings();
    const safeSettings = sanitizeSettings(settings);
    
    const enableRequestLogs = process.env.ENABLE_REQUEST_LOGS === "true";
    const enableTranslator = process.env.ENABLE_TRANSLATOR === "true";
    
    return NextResponse.json({ 
      ...safeSettings, 
      comboPerformance: getComboPerformanceSnapshot(),
      enableRequestLogs,
      enableTranslator,
      hasPassword: false
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.log("Error getting settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 100) {
      console.log(`[PERF] GET /api/settings took ${durationMs}ms`);
    }
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (Object.prototype.hasOwnProperty.call(body, "newPassword") || Object.prototype.hasOwnProperty.call(body, "currentPassword") || Object.prototype.hasOwnProperty.call(body, "password")) {
      return NextResponse.json({ error: "Password auth has been removed. Use OAuth QR login." }, { status: 410 });
    }

    const settings = await updateSettings(body);

    // Apply outbound proxy settings immediately (no restart required)
    if (
      Object.prototype.hasOwnProperty.call(body, "outboundProxyEnabled") ||
      Object.prototype.hasOwnProperty.call(body, "outboundProxyUrl") ||
      Object.prototype.hasOwnProperty.call(body, "outboundNoProxy")
    ) {
      applyOutboundProxyEnv(settings);
    }

    // Invalidate combo rotation state when strategy settings change
    if (
      Object.prototype.hasOwnProperty.call(body, "comboStrategy") ||
      Object.prototype.hasOwnProperty.call(body, "comboStrategies") ||
      Object.prototype.hasOwnProperty.call(body, "comboSlowModelCooldownEnabled")
    ) {
      resetComboRotation();
    }

    return NextResponse.json(sanitizeSettings(settings));
  } catch (error) {
    console.log("Error updating settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
