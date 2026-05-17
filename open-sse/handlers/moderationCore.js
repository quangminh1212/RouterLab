import { createErrorResult } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";
import { AI_PROVIDERS } from "../../src/shared/constants/providers.js";
import { NextResponse } from "next/server";

const FALLBACK_MODERATION_CONFIGS = {
  openai: {
    baseUrl: "https://api.openai.com/v1/moderations",
    authType: "apikey",
    authHeader: "bearer",
    format: "openai",
  },
  azure: {
    baseUrl: "azure",
    authType: "apikey",
    authHeader: "api-key",
    format: "azure",
  },
};

/**
 * Build auth headers from moderationConfig + credentials
 */
function buildAuthHeaders(cfg, credentials) {
  const token = credentials?.apiKey || credentials?.accessToken;
  if (!token) return {};
  
  switch (cfg.authHeader) {
    case "bearer":     return { "Authorization": `Bearer ${token}` };
    case "x-api-key":  return { "x-api-key": token };
    default:           return { "Authorization": `Bearer ${token}` };
  }
}

/**
 * OpenAI moderation format
 */
async function moderateOpenAI(cfg, input, model, credentials) {
  const headers = {
    ...buildAuthHeaders(cfg, credentials),
    "Content-Type": "application/json",
  };
  
  const body = { input, model };
  
  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI moderation failed: ${res.status} ${txt}`);
  }
  
  return await res.json();
}

/**
 * Azure moderation format (similar to OpenAI)
 */
async function moderateAzure(cfg, input, model, credentials, providerSpecificData) {
  const endpoint = (providerSpecificData?.azureEndpoint || "").replace(/\/$/, "");
  const apiVersion = providerSpecificData?.apiVersion || "2024-10-01-preview";
  const url = `${endpoint}/openai/moderations?api-version=${apiVersion}`;
  
  const headers = {
    "api-key": credentials?.apiKey,
    "Content-Type": "application/json",
  };
  
  const body = { input, model };
  
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Azure moderation failed: ${res.status} ${txt}`);
  }
  
  return await res.json();
}

/**
 * Core moderation handler - config-driven dispatch
 * @returns {Promise<{success, response, status?, error?}>}
 */
export async function handleModerationCore({ provider, model, input, credentials, providerSpecificData }) {
  if (!input) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required field: input");
  }
  
  const cfg = AI_PROVIDERS[provider]?.moderationConfig || FALLBACK_MODERATION_CONFIGS[provider];
  if (!cfg) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, `Provider '${provider}' does not support moderation`);
  }
  
  const token = cfg.authType === "none" ? null : (credentials?.apiKey || credentials?.accessToken);
  if (cfg.authType !== "none" && !token) {
    return createErrorResult(HTTP_STATUS.UNAUTHORIZED, `No credentials for moderation provider: ${provider}`);
  }
  
  try {
    let result;
    
    switch (cfg.format) {
      case "openai":
        result = await moderateOpenAI(cfg, input, model, credentials);
        break;
      case "azure":
        result = await moderateAzure(cfg, input, model, credentials, providerSpecificData);
        break;
      default:
        // Generic OpenAI-compatible format
        result = await moderateOpenAI(cfg, input, model, credentials);
    }
    
    return {
      success: true,
      response: NextResponse.json(result, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }),
    };
  } catch (err) {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, err.message || "Moderation request failed");
  }
}
