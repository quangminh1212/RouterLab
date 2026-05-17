import { createErrorResult } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";
import { AI_PROVIDERS } from "../../src/shared/constants/providers.js";
import { NextResponse } from "next/server";

const FALLBACK_RERANK_CONFIGS = {
  cohere: {
    baseUrl: "https://api.cohere.com/v2/rerank",
    authType: "apikey",
    authHeader: "bearer",
    format: "cohere",
  },
  "jina-ai": {
    baseUrl: "https://api.jina.ai/v1/rerank",
    authType: "apikey",
    authHeader: "bearer",
    format: "jina",
  },
  "voyage-ai": {
    baseUrl: "https://api.voyageai.com/v1/rerank",
    authType: "apikey",
    authHeader: "bearer",
    format: "voyage",
  },
};

/**
 * Build auth headers from rerankConfig + credentials
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
 * Cohere rerank format
 */
async function rerankCohere(cfg, query, documents, model, credentials, topN) {
  const headers = {
    ...buildAuthHeaders(cfg, credentials),
    "Content-Type": "application/json",
  };
  
  const body = {
    model,
    query,
    documents: documents.map(doc => typeof doc === "string" ? doc : doc.text),
    top_n: topN,
  };
  
  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Cohere rerank failed: ${res.status} ${txt}`);
  }
  
  return await res.json();
}

/**
 * Jina rerank format (similar to Cohere)
 */
async function rerankJina(cfg, query, documents, model, credentials, topN) {
  const headers = {
    ...buildAuthHeaders(cfg, credentials),
    "Content-Type": "application/json",
  };
  
  const body = {
    model,
    query,
    documents: documents.map(doc => typeof doc === "string" ? doc : doc.text),
    top_n: topN,
  };
  
  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Jina rerank failed: ${res.status} ${txt}`);
  }
  
  return await res.json();
}

/**
 * Voyage rerank format
 */
async function rerankVoyage(cfg, query, documents, model, credentials, topN) {
  const headers = {
    ...buildAuthHeaders(cfg, credentials),
    "Content-Type": "application/json",
  };
  
  const body = {
    model,
    query,
    documents: documents.map(doc => typeof doc === "string" ? doc : doc.text),
    top_k: topN, // Voyage uses top_k instead of top_n
  };
  
  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Voyage rerank failed: ${res.status} ${txt}`);
  }
  
  return await res.json();
}

/**
 * Core rerank handler - config-driven dispatch
 * @returns {Promise<{success, response, status?, error?}>}
 */
export async function handleRerankCore({ provider, model, query, documents, credentials, topN }) {
  if (!query || !Array.isArray(documents) || documents.length === 0) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required fields: query, documents");
  }
  
  const cfg = AI_PROVIDERS[provider]?.rerankConfig || FALLBACK_RERANK_CONFIGS[provider];
  if (!cfg) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, `Provider '${provider}' does not support rerank`);
  }
  
  const token = cfg.authType === "none" ? null : (credentials?.apiKey || credentials?.accessToken);
  if (cfg.authType !== "none" && !token) {
    return createErrorResult(HTTP_STATUS.UNAUTHORIZED, `No credentials for rerank provider: ${provider}`);
  }
  
  try {
    let result;
    
    switch (cfg.format) {
      case "cohere":
        result = await rerankCohere(cfg, query, documents, model, credentials, topN);
        break;
      case "jina":
        result = await rerankJina(cfg, query, documents, model, credentials, topN);
        break;
      case "voyage":
        result = await rerankVoyage(cfg, query, documents, model, credentials, topN);
        break;
      default:
        // Generic Cohere-compatible format
        result = await rerankCohere(cfg, query, documents, model, credentials, topN);
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
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, err.message || "Rerank request failed");
  }
}
