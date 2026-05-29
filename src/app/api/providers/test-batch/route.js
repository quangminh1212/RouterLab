import { NextResponse } from "next/server";
import { getProviderConnections } from "@/models";
import {
  FREE_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
} from "@/shared/constants/providers";
import { testSingleConnection } from "../[id]/test/testUtils.js";

async function fetchCompatibleModels(connection) {
  const baseUrl = connection?.providerSpecificData?.baseUrl;
  if (!baseUrl) return { ok: false, error: "Missing base URL", models: [] };

  const normalizedBase = String(baseUrl).replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${connection.apiKey}`,
    "x-api-key": connection.apiKey,
    "anthropic-version": "2023-06-01",
  };

  try {
    const res = await fetch(`${normalizedBase}/models`, { headers });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, models: [] };
    }

    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data?.data) ? data.data : [];
    const models = rows
      .map((item) => ({
        modelId: item?.id || "",
        modelName: item?.name || item?.id || "",
      }))
      .filter((item) => item.modelId);

    return { ok: true, error: null, models };
  } catch (error) {
    return { ok: false, error: error.message, models: [] };
  }
}

function getAuthGroup(providerId, connection = null) {
  // Prioritize authType from connection if available
  if (connection?.authType) {
    if (connection.authType === "oauth") {
      // Check if it's a free provider
      if (FREE_PROVIDERS[providerId]) return "free";
      return "oauth";
    }
    return connection.authType;
  }
  
  // Fallback to constants
  if (FREE_PROVIDERS[providerId]) return "free";
  if (OAUTH_PROVIDERS[providerId]) return "oauth";
  if (APIKEY_PROVIDERS[providerId]) return "apikey";
  if (
    typeof providerId === "string" &&
    (providerId.startsWith(OPENAI_COMPATIBLE_PREFIX) || providerId.startsWith(ANTHROPIC_COMPATIBLE_PREFIX))
  )
    return "compatible";
  return "apikey";
}

function isCompatibleProvider(providerId) {
  return (
    typeof providerId === "string" &&
    (providerId.startsWith(OPENAI_COMPATIBLE_PREFIX) || providerId.startsWith(ANTHROPIC_COMPATIBLE_PREFIX))
  );
}

// POST /api/providers/test-batch - Test multiple connections by group
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { mode, providerId } = body;

    if (!mode) {
      return NextResponse.json({ error: "mode is required" }, { status: 400 });
    }

    const allConnections = await getProviderConnections({ isActive: true });

    let connectionsToTest = [];
    if (mode === "provider" && providerId) {
      connectionsToTest = allConnections.filter((c) => c.provider === providerId);
    } else if (mode === "oauth") {
      connectionsToTest = allConnections.filter((c) => getAuthGroup(c.provider, c) === "oauth");
    } else if (mode === "free") {
      connectionsToTest = allConnections.filter((c) => getAuthGroup(c.provider, c) === "free");
    } else if (mode === "apikey") {
      connectionsToTest = allConnections.filter((c) => getAuthGroup(c.provider, c) === "apikey");
    } else if (mode === "compatible") {
      connectionsToTest = allConnections.filter((c) => isCompatibleProvider(c.provider));
    } else if (mode === "all") {
      connectionsToTest = allConnections;
    } else {
      return NextResponse.json(
        { error: "Invalid mode. Use: provider, oauth, free, apikey, compatible, all" },
        { status: 400 }
      );
    }

    if (connectionsToTest.length === 0) {
      return NextResponse.json({
        mode,
        providerId: providerId || null,
        results: [],
        summary: { total: 0, passed: 0, failed: 0 },
        testedAt: new Date().toISOString(),
      });
    }

    const results = [];

    if (mode === "compatible") {
      for (const conn of connectionsToTest) {
        const modelFetch = await fetchCompatibleModels(conn);

        if (!modelFetch.ok) {
          results.push({
            provider: conn.provider,
            connectionId: conn.id,
            connectionName: conn.name || conn.email || conn.provider,
            authType: conn.authType || getAuthGroup(conn.provider, conn),
            modelId: null,
            valid: false,
            latencyMs: 0,
            error: modelFetch.error,
            diagnosis: { type: "model_list_error", source: "provider", code: null, message: modelFetch.error },
            statusCode: null,
            testedAt: new Date().toISOString(),
          });
          continue;
        }

        for (const model of modelFetch.models) {
          results.push({
            provider: conn.provider,
            connectionId: conn.id,
            connectionName: conn.name || conn.email || conn.provider,
            authType: conn.authType || getAuthGroup(conn.provider, conn),
            modelId: model.modelId,
            modelName: model.modelName,
            valid: true,
            latencyMs: 0,
            error: null,
            diagnosis: null,
            statusCode: 200,
            testedAt: new Date().toISOString(),
          });
        }
      }

      return NextResponse.json({
        mode,
        providerId: providerId || null,
        results,
        testedAt: new Date().toISOString(),
        summary: {
          total: results.length,
          passed: results.filter((r) => r.valid).length,
          failed: results.filter((r) => !r.valid).length,
        },
      });
    }

    for (const conn of connectionsToTest) {
      try {
        const data = await testSingleConnection(conn.id);
        results.push({
          provider: conn.provider,
          connectionId: conn.id,
          connectionName: conn.name || conn.email || conn.provider,
          authType: conn.authType || getAuthGroup(conn.provider, conn),
          valid: data.valid,
          latencyMs: data.latencyMs || 0,
          error: data.error || null,
          diagnosis: data.diagnosis || null,
          statusCode: data.statusCode || null,
          testedAt: data.testedAt || new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          provider: conn.provider,
          connectionId: conn.id,
          connectionName: conn.name || conn.email || conn.provider,
          authType: conn.authType || getAuthGroup(conn.provider, conn),
          valid: false,
          latencyMs: 0,
          error: error.message,
          diagnosis: { type: "network_error", source: "local", code: null, message: error.message },
          statusCode: null,
          testedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      mode,
      providerId: providerId || null,
      results,
      testedAt: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter((r) => r.valid).length,
        failed: results.filter((r) => !r.valid).length,
      },
    });
  } catch (error) {
    console.log("Error in batch test:", error);
    return NextResponse.json({ error: "Batch test failed" }, { status: 500 });
  }
}
