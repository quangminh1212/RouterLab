import { NextResponse } from "next/server";
import {
  getProviderConnections,
  createProviderConnection,
  getProviderNodeById,
  getProviderNodes,
  getProxyPoolById,
} from "@/models";
import { APIKEY_PROVIDERS } from "@/shared/constants/config";
import { FREE_TIER_PROVIDERS, WEB_COOKIE_PROVIDERS, isOpenAICompatibleProvider, isAnthropicCompatibleProvider, isCustomEmbeddingProvider, resolveXiaomiTokenPlanBaseUrl } from "@/shared/constants/providers";

export const dynamic = "force-dynamic";

const PROVIDERS_GET_CACHE_TTL_MS = 3000;
let providersGetCache = { ts: 0, data: null, promise: null };

function normalizeProxyConfig(body = {}) {
  const enabled = body?.connectionProxyEnabled === true;
  const url = typeof body?.connectionProxyUrl === "string" ? body.connectionProxyUrl.trim() : "";
  const noProxy = typeof body?.connectionNoProxy === "string" ? body.connectionNoProxy.trim() : "";

  if (enabled && !url) {
    return { error: "Connection proxy URL is required when connection proxy is enabled" };
  }

  return {
    connectionProxyEnabled: enabled,
    connectionProxyUrl: url,
    connectionNoProxy: noProxy,
  };
}

async function normalizeProxyPoolId(proxyPoolId) {
  if (proxyPoolId === undefined || proxyPoolId === null || proxyPoolId === "" || proxyPoolId === "__none__") {
    return { proxyPoolId: null };
  }

  const normalizedId = String(proxyPoolId).trim();
  if (!normalizedId) {
    return { proxyPoolId: null };
  }

  const proxyPool = await getProxyPoolById(normalizedId);
  if (!proxyPool) {
    return { error: "Proxy pool not found" };
  }

  return { proxyPoolId: normalizedId };
}

function isTamMaoCompatibleNode(node = {}) {
  const baseUrl = String(node.baseUrl || "").toLowerCase();
  const name = String(node.name || "").toLowerCase();
  return baseUrl.includes("cungcapai") || baseUrl.includes("electroai") || name.includes("tammao");
}

function normalizeProviderSpecificData(provider, providerSpecificData) {
  const normalized = providerSpecificData && typeof providerSpecificData === "object" && !Array.isArray(providerSpecificData)
    ? { ...providerSpecificData }
    : {};

  if (provider === "xiaomi-tokenplan") {
    const region = String(normalized.region || "sgp").trim().toLowerCase() || "sgp";
    normalized.region = region;
    normalized.baseUrl = resolveXiaomiTokenPlanBaseUrl(region);
  }

  return normalized;
}

function normalizeBaseUrls(baseUrls) {
  const values = Array.isArray(baseUrls) ? baseUrls : String(baseUrls || "").split(/[\n,]+/);
  return [...new Set(values
    .map((baseUrl) => String(baseUrl || "").trim().replace(/\/+$/, ""))
    .filter(Boolean))];
}

// GET /api/providers - List all connections
export async function GET() {
  try {
    const now = Date.now();
    if (providersGetCache.data && now - providersGetCache.ts < PROVIDERS_GET_CACHE_TTL_MS) {
      return NextResponse.json(
        { connections: providersGetCache.data },
        { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } }
      );
    }

    if (providersGetCache.promise) {
      const safeConnections = await providersGetCache.promise;
      return NextResponse.json(
        { connections: safeConnections },
        { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } }
      );
    }

    providersGetCache.promise = (async () => {
      const connections = await getProviderConnections({ forceRefresh: true });

      let nodeNameMap = {};
      const needsNodeNames = connections.some((c) => isOpenAICompatibleProvider(c.provider) || isAnthropicCompatibleProvider(c.provider));
      if (needsNodeNames) {
        try {
          const nodes = await getProviderNodes();
          for (const node of nodes) {
            if (node.id && node.name) nodeNameMap[node.id] = node.name;
          }
        } catch {}
      }

      const safeConnections = connections.map(c => {
        const isCompatible = isOpenAICompatibleProvider(c.provider) || isAnthropicCompatibleProvider(c.provider);
        const name = isCompatible
          ? (nodeNameMap[c.provider] || c.providerSpecificData?.nodeName || c.provider)
          : c.name;
        return {
          ...c,
          name,
          apiKey: undefined,
          accessToken: undefined,
          refreshToken: undefined,
          idToken: undefined,
        };
      });

      providersGetCache = { ts: Date.now(), data: safeConnections, promise: null };
      return safeConnections;
    })();

    const safeConnections = await providersGetCache.promise;
    return NextResponse.json(
      { connections: safeConnections },
      { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } }
    );
  } catch (error) {
    providersGetCache.promise = null;
    console.log("Error fetching providers:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}

// POST /api/providers - Create new connection (API Key only, OAuth via separate flow)
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { provider, apiKey, name, priority, globalPriority, defaultModel, testStatus } = body;
    const proxyConfig = normalizeProxyConfig(body);
    if (proxyConfig.error) {
      return NextResponse.json({ error: proxyConfig.error }, { status: 400 });
    }

    const proxyPoolResult = await normalizeProxyPoolId(body.proxyPoolId);
    if (proxyPoolResult.error) {
      return NextResponse.json({ error: proxyPoolResult.error }, { status: 400 });
    }
    const proxyPoolId = proxyPoolResult.proxyPoolId;

    // Validation
    const isWebCookieProvider = !!WEB_COOKIE_PROVIDERS[provider];
    const isValidProvider = APIKEY_PROVIDERS[provider] ||
      FREE_TIER_PROVIDERS[provider] ||
      isWebCookieProvider ||
      isOpenAICompatibleProvider(provider) ||
      isAnthropicCompatibleProvider(provider) ||
      isCustomEmbeddingProvider(provider);

    if (!provider || !isValidProvider) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: `${isWebCookieProvider ? "Cookie value" : "API Key"} is required` }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let providerSpecificData = normalizeProviderSpecificData(provider, body.providerSpecificData);

    if (isOpenAICompatibleProvider(provider)) {
      const node = await getProviderNodeById(provider);
      if (!node) {
        return NextResponse.json({ error: "OpenAI Compatible node not found" }, { status: 404 });
      }

      if (!isTamMaoCompatibleNode(node)) {
        const existingConnections = await getProviderConnections({ provider });
        if (existingConnections.length > 0) {
          return NextResponse.json({ error: "Only one connection is allowed for this OpenAI Compatible node" }, { status: 400 });
        }
      }

      const tamMaoBaseUrls = isTamMaoCompatibleNode(node) ? normalizeBaseUrls(providerSpecificData.baseUrls) : [];
      const tamMaoBaseUrl = String(providerSpecificData.baseUrl || tamMaoBaseUrls[0] || "").trim().replace(/\/+$/, "");

      providerSpecificData = {
        prefix: node.prefix,
        apiType: node.apiType,
        baseUrl: tamMaoBaseUrl || node.baseUrl,
        nodeName: node.name,
        ...(tamMaoBaseUrls.length > 0 ? { baseUrls: tamMaoBaseUrls } : {}),
      };
    } else if (isAnthropicCompatibleProvider(provider)) {
      const node = await getProviderNodeById(provider);
      if (!node) {
        return NextResponse.json({ error: "Anthropic Compatible node not found" }, { status: 404 });
      }

      const existingConnections = await getProviderConnections({ provider });
      if (existingConnections.length > 0) {
        return NextResponse.json({ error: "Only one connection is allowed for this Anthropic Compatible node" }, { status: 400 });
      }

      providerSpecificData = {
        prefix: node.prefix,
        baseUrl: node.baseUrl,
        nodeName: node.name,
      };
    } else if (isCustomEmbeddingProvider(provider)) {
      const node = await getProviderNodeById(provider);
      if (!node) {
        return NextResponse.json({ error: "Custom Embedding node not found" }, { status: 404 });
      }

      const existingConnections = await getProviderConnections({ provider });
      if (existingConnections.length > 0) {
        return NextResponse.json({ error: "Only one connection is allowed for this Custom Embedding node" }, { status: 400 });
      }

      providerSpecificData = {
        prefix: node.prefix,
        baseUrl: node.baseUrl,
        nodeName: node.name,
      };
    }

    const mergedProviderSpecificData = {
      ...(providerSpecificData || {}),
      connectionProxyEnabled: proxyConfig.connectionProxyEnabled,
      connectionProxyUrl: proxyConfig.connectionProxyUrl,
      connectionNoProxy: proxyConfig.connectionNoProxy,
    };

    if (proxyPoolId !== null) {
      mergedProviderSpecificData.proxyPoolId = proxyPoolId;
    }

    const newConnection = await createProviderConnection({
      provider,
      authType: isWebCookieProvider ? "cookie" : "apikey",
      name,
      apiKey,
      priority: priority || 1,
      globalPriority: globalPriority || null,
      defaultModel: defaultModel || null,
      providerSpecificData: mergedProviderSpecificData,
      isActive: true,
      testStatus: testStatus || "unknown",
    });

    // Hide sensitive fields
    const result = { ...newConnection };
    delete result.apiKey;

    return NextResponse.json({ connection: result, ...result }, { status: 201 });
  } catch (error) {
    console.log("Error creating provider:", error);
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 });
  }
}

