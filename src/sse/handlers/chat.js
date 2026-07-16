import "open-sse/index.js";

import {
  getProviderCredentials,
  markAccountUnavailable,
  clearAccountError,
  extractApiKey,
  isValidApiKey,
  bindSessionToConnection,
} from "../services/auth.js";
import { cacheClaudeHeaders } from "open-sse/utils/claudeHeaderCache.js";
import { getSettings } from "@/lib/localDb";
import { getModelInfo, getComboModels } from "../services/model.js";
import { isPublicFreeRequest } from "../services/freePublic.js";
import { isAutoModel, resolveAutoModel } from "../services/autoRoute.js";
import { handleChatCore } from "open-sse/handlers/chatCore.js";
import { errorResponse, unavailableResponse } from "open-sse/utils/error.js";
import { handleComboChat } from "open-sse/services/combo.js";
import {
  buildHandoffPayload,
  clearContextHandoff,
  extractSessionId,
  injectHandoffIntoBody,
  loadContextHandoff,
  storeContextHandoff,
} from "open-sse/services/contextHandoff.js";
import { handleBypassRequest } from "open-sse/utils/bypassHandler.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";
import { INTERNAL_REQUEST_HEADER } from "open-sse/config/appConstants.js";
import { detectFormatByEndpoint } from "open-sse/translator/formats.js";
import * as log from "../utils/logger.js";
import { updateProviderCredentials, checkAndRefreshToken } from "../services/tokenRefresh.js";
import { getProjectIdForConnection } from "open-sse/services/projectId.js";
import {
  computeRequestDedupHash,
  shouldDeduplicateRequest,
  withRequestDedup,
} from "../services/requestDedup.js";
import {
  canExecuteProvider,
  isBreakerTrippableStatus,
  recordProviderFailure,
  recordProviderSuccess,
} from "../services/providerBreaker.js";

function flattenMessageText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n");
  }
  return "";
}

function mergeSystemIntoFirstUserMessage(body) {
  if (!Array.isArray(body?.messages) || body.__systemPromptMerged) return null;

  const systemText = body.messages
    .filter((message) => message?.role === "system")
    .map((message) => flattenMessageText(message?.content))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!systemText) return null;

  const messages = body.messages
    .filter((message) => message?.role !== "system")
    .map((message) => ({ ...message }));

  const firstUserIndex = messages.findIndex((message) => message?.role === "user");
  const prefix = `[System Instructions]\n${systemText}`;

  if (firstUserIndex >= 0) {
    const firstUser = messages[firstUserIndex];
    const userText = flattenMessageText(firstUser?.content).trim();
    messages[firstUserIndex] = {
      ...firstUser,
      content: userText ? `${prefix}\n\n[User]\n${userText}` : prefix,
    };
  } else {
    messages.unshift({ role: "user", content: prefix });
  }

  return {
    ...body,
    __systemPromptMerged: true,
    messages,
  };
}

const MODEL_SOFT_FALLBACK_ERRORS = [
  "selected model is at capacity",
  "try a different model",
  "model is at capacity",
  "model is overloaded",
  "currently overloaded",
  "servers are currently overloaded",
];

function shouldFallbackToAlternateModel(status, errorText) {
  if (![HTTP_STATUS.TOO_MANY_REQUESTS, HTTP_STATUS.SERVICE_UNAVAILABLE, HTTP_STATUS.BAD_GATEWAY, 529].includes(status)) {
    return false;
  }
  const message = String(errorText || "").toLowerCase();
  return MODEL_SOFT_FALLBACK_ERRORS.some((pattern) => message.includes(pattern));
}

function getAlternateModelCandidates(provider, model) {
  const current = provider ? `${provider}/${model}` : model;
  return ["openclaw", "xlabrouter/openclaw"].filter((candidate) => candidate && candidate !== current);
}

async function tryAlternateModels({ body, provider, model, clientRawRequest, request, apiKey, status, errorText }) {
  if (body?.__modelSoftFallbackTried) return null;
  if (!shouldFallbackToAlternateModel(status, errorText)) return null;

  const candidates = getAlternateModelCandidates(provider, model);
  for (const candidate of candidates) {
    log.warn("CHAT", `[${provider}/${model}] upstream capacity error, trying alternate model ${candidate}`);
    const fallbackBody = {
      ...body,
      model: candidate,
      __modelSoftFallbackFrom: `${provider}/${model}`,
      __modelSoftFallbackTried: true,
    };
    const response = await handleSingleModelChat(fallbackBody, candidate, clientRawRequest, request, apiKey);
    if (response?.ok) return response;
  }
  return null;
}

function getOpenClawAllowTokens() {
  const compatToken = String(process.env.OPENCLAW_COMPAT_TOKEN || "").trim();
  const envTokens = String(process.env.OPENCLAW_TUNNEL_ALLOW_TOKENS || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const defaults = compatToken ? [compatToken] : [];
  return new Set([...defaults, ...envTokens]);
}

function isOpenClawTunnelRequest(request, apiKey) {
  const host = request?.headers?.get("host") || "";
  const userAgent = request?.headers?.get("user-agent") || "";
  const keyAllowed = apiKey ? getOpenClawAllowTokens().has(apiKey) : false;
  return host.includes("api.xlabrnd.com") && (keyAllowed || /openclaw|openai\/js/i.test(userAgent));
}

function buildOpenClawCompatBody(body) {
  if (!body || typeof body !== "object") return body;
  const next = { ...body };
  if (typeof next.max_completion_tokens === "number" && typeof next.max_tokens !== "number") {
    next.max_tokens = next.max_completion_tokens;
  }
  delete next.max_completion_tokens;
  delete next.tools;
  delete next.tool_choice;
  delete next.parallel_tool_calls;
  delete next.reasoning;
  delete next.reasoning_effort;
  delete next.response_format;
  delete next.metadata;
  delete next.store;
  delete next.prediction;
  return next;
}

function normalizeOpenClawTunnelModel(body) {
  if (!body || typeof body !== "object") return body;
  if (body.model === "xlabrouter/openclaw" || body.model === "openclaw") return body;
  if (body.model === "kr/claude-haiku-4.5" || body.model === "xlabrouter/kr/claude-haiku-4.5") {
    return { ...body, model: "xlabrouter/openclaw" };
  }
  return body;
}

/**
 * Handle chat completion request
 * Supports: OpenAI, Claude, Gemini, OpenAI Responses API formats
 * Format detection and translation handled by translator
 */
export async function handleChat(request, clientRawRequest = null) {
  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("CHAT", "Invalid JSON body");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body");
  }

  // Build clientRawRequest for logging (if not provided)
  if (!clientRawRequest) {
    const url = new URL(request.url);
    clientRawRequest = {
      endpoint: url.pathname,
      body,
      headers: Object.fromEntries(request.headers.entries())
    };
  }
  cacheClaudeHeaders(clientRawRequest.headers);

  // Log API key (masked)
  const authHeader = request.headers.get("Authorization");
  const apiKey = extractApiKey(request);
  const isInternalDashboardRequest = request.headers.get(INTERNAL_REQUEST_HEADER.name) === INTERNAL_REQUEST_HEADER.value;
  const openClawTunnelCompat = isOpenClawTunnelRequest(request, apiKey);
  if (openClawTunnelCompat) {
    body = normalizeOpenClawTunnelModel(body);
    if (clientRawRequest?.body && typeof clientRawRequest.body === "object") {
      clientRawRequest.body = { ...clientRawRequest.body, model: body.model };
    }
  }
  if (authHeader && apiKey) {
    const masked = log.maskKey(apiKey);
    log.debug("AUTH", `API Key: ${masked}`);
  } else {
    log.debug("AUTH", "No API key provided (local mode)");
  }

  // Log request endpoint and model
  const url = new URL(request.url);
  const modelStr = body.model;

  // Count messages (support both messages[] and input[] formats)
  const msgCount = body.messages?.length || body.input?.length || 0;
  const toolCount = body.tools?.length || 0;
  const effort = body.reasoning_effort || body.reasoning?.effort || null;
  log.request("POST", `${url.pathname} | ${modelStr} | ${msgCount} msgs${toolCount ? ` | ${toolCount} tools` : ""}${effort ? ` | effort=${effort}` : ""}`);

  // Enforce API key if enabled in settings.
  // Exception: pure noAuth free providers (pollinations/opencode/uncloseai/...) may be
  // called without XLab login/API key — same idea as 9router public free routes.
  const settings = await getSettings();
  if (!modelStr) {
    log.warn("CHAT", "Missing model");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing model");
  }

  const publicFree = await isPublicFreeRequest(modelStr, settings);
  if (settings.requireApiKey && !isInternalDashboardRequest && !publicFree) {
    if (!apiKey) {
      log.warn("AUTH", "Missing API key (requireApiKey=true)");
      return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Missing API key");
    }
    const valid = await isValidApiKey(apiKey, { model: modelStr });
    if (!valid) {
      log.warn("AUTH", "Invalid API key (requireApiKey=true)");
      return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
    }
  } else if (publicFree && !apiKey) {
    log.debug("AUTH", `Public free model allowed without API key: ${modelStr}`);
  }

  // "auto" zero-config routing: resolve to the best connected provider/model.
  let effectiveModelStr = modelStr;
  if (isAutoModel(modelStr)) {
    const resolved = await resolveAutoModel(modelStr);
    if (!resolved) {
      return errorResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, "auto: no connected provider available");
    }
    log.info("CHAT", `auto -> ${resolved}`);
    effectiveModelStr = resolved;
    body = { ...body, model: resolved };
  }

  // Bypass naming/warmup requests before combo rotation to avoid wasting rotation slots
  const userAgent = request?.headers?.get("user-agent") || "";
  const bypassResponse = handleBypassRequest(body, effectiveModelStr, userAgent, !!settings.ccFilterNaming);
  if (bypassResponse) return bypassResponse.response || bypassResponse;

  // Check if model is a combo (has multiple models with fallback)
  const comboModels = await getComboModels(effectiveModelStr);
  if (comboModels) {
    // Check for combo-specific strategy first, fallback to global
    const comboStrategies = settings.comboStrategies || {};
    const comboSpecificStrategy = comboStrategies[effectiveModelStr]?.fallbackStrategy;
    const comboStrategy = comboSpecificStrategy || settings.comboStrategy || "fallback";
    const comboStickyLimit = Math.max(1, Number(comboStrategies[effectiveModelStr]?.stickyRoundRobinLimit || settings.comboStickyRoundRobinLimit || 1));
    const fusionJudgeModel = comboStrategies[effectiveModelStr]?.fusionJudgeModel || settings.fusionJudgeModel || null;

    log.info("CHAT", `Combo "${effectiveModelStr}" with ${comboModels.length} models (strategy: ${comboStrategy}, stickyLimit: ${comboStickyLimit})`);
    return handleComboChat({
      body,
      models: comboModels,
      handleSingleModel: (b, m) => handleSingleModelChat(b, m, clientRawRequest, request, apiKey, { comboName: effectiveModelStr, openClawTunnelCompat }),
      log,
      comboName: effectiveModelStr,
      comboStrategy,
      comboStickyLimit,
      comboSlowModelCooldownEnabled: settings.comboSlowModelCooldownEnabled !== false,
      fusionJudgeModel,
    });
  }

  // Single model request
  return handleSingleModelChat(
    body,
    effectiveModelStr,
    clientRawRequest,
    request,
    apiKey,
    { openClawTunnelCompat, settings }
  );
}

/**
 * Handle single model chat request
 */
async function handleSingleModelChat(body, modelStr, clientRawRequest = null, request = null, apiKey = null, options = {}) {
  const modelInfo = await getModelInfo(modelStr);

  // If provider is null, this might be a combo name - check and handle
  if (!modelInfo.provider) {
    const comboName = modelInfo.model || modelStr;
    const comboModels = await getComboModels(comboName);
    if (comboModels) {
      const chatSettings = options.settings || await getSettings();
      // Check for combo-specific strategy first, fallback to global
      const comboStrategies = chatSettings.comboStrategies || {};
      const comboSpecificStrategy = comboStrategies[comboName]?.fallbackStrategy;
      const comboStrategy = comboSpecificStrategy || chatSettings.comboStrategy || "fallback";
      const comboStickyLimit = Math.max(1, Number(comboStrategies[comboName]?.stickyRoundRobinLimit || chatSettings.comboStickyRoundRobinLimit || 1));
      const fusionJudgeModel = comboStrategies[comboName]?.fusionJudgeModel || chatSettings.fusionJudgeModel || null;
      
      log.info("CHAT", `Combo "${comboName}" with ${comboModels.length} models (strategy: ${comboStrategy}, stickyLimit: ${comboStickyLimit})`);
      return handleComboChat({
        body,
        models: comboModels,
        handleSingleModel: (b, m) => handleSingleModelChat(b, m, clientRawRequest, request, apiKey, { ...options, comboName, settings: chatSettings }),
        log,
        comboName,
        comboStrategy,
        comboStickyLimit,
        comboSlowModelCooldownEnabled: chatSettings.comboSlowModelCooldownEnabled !== false,
        fusionJudgeModel,
      });
    }
    log.warn("CHAT", "Invalid model format", { model: modelStr });
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid model format");
  }

  const { provider, model } = modelInfo;

  // Log model routing (alias -> actual model)
  if (modelStr !== `${provider}/${model}`) {
    log.info("ROUTING", `${modelStr} -> ${provider}/${model}`);
  } else {
    log.info("ROUTING", `Provider: ${provider}, Model: ${model}`);
  }

  // Extract userAgent from request
  const userAgent = request?.headers?.get("user-agent") || "";
  const sessionId = extractSessionId(body);
  const clientSessionId = request?.headers?.get("x-session-id") || body?.session_id || null;
  const contextRelayKey = options.comboName || `${provider}/${model}`;

  // Try with available accounts (fallback on errors)
  const excludeConnectionIds = new Set();
  let lastError = null;
  let lastStatus = null;

  while (true) {
    if (!canExecuteProvider(provider)) {
      const message = `[${provider}/${model}] provider circuit is open`;
      log.warn("BREAKER", message);
      return errorResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, message);
    }

    const credentials = await getProviderCredentials(provider, excludeConnectionIds, model, { sessionId: clientSessionId });

    // All accounts unavailable
    if (!credentials || credentials.allRateLimited) {
      if (credentials?.allRateLimited) {
        const errorMsg = lastError || credentials.lastError || "Unavailable";
        const status = lastStatus || Number(credentials.lastErrorCode) || HTTP_STATUS.SERVICE_UNAVAILABLE;
        const alternateModelResponse = await tryAlternateModels({
          body,
          provider,
          model,
          clientRawRequest,
          request,
          apiKey,
          status,
          errorText: errorMsg,
        });
        if (alternateModelResponse) return alternateModelResponse;
        log.warn("CHAT", `[${provider}/${model}] ${errorMsg} (${credentials.retryAfterHuman})`);
        return unavailableResponse(status, `[${provider}/${model}] ${errorMsg}`, credentials.retryAfter, credentials.retryAfterHuman);
      }
      if (excludeConnectionIds.size === 0) {
        log.warn("AUTH", `No active credentials for provider: ${provider}`);
        return errorResponse(HTTP_STATUS.NOT_FOUND, `No active credentials for provider: ${provider}`);
      }
      log.warn("CHAT", "No more accounts available", { provider });
      return errorResponse(lastStatus || HTTP_STATUS.SERVICE_UNAVAILABLE, lastError || "All accounts unavailable");
    }

    // Log account selection
    log.info("AUTH", `\x1b[32mUsing ${provider} account: ${credentials.connectionName}\x1b[0m`);

    const refreshedCredentials = await checkAndRefreshToken(provider, credentials);

    // Ensure real project ID is available for providers that need it (P0 fix: cold miss)
    if ((provider === "antigravity" || provider === "gemini-cli") && !refreshedCredentials.projectId) {
      const pid = await getProjectIdForConnection(credentials.connectionId, refreshedCredentials.accessToken);
      if (pid) {
        refreshedCredentials.projectId = pid;
        // Persist to DB in background so subsequent requests have it immediately
        updateProviderCredentials(credentials.connectionId, { projectId: pid }).catch(() => { });
      }
    }

    // Use shared chatCore
    const chatSettings = options.settings || await getSettings();
    const providerThinking = (chatSettings.providerThinking || {})[provider] || null;
    let requestBody = options.openClawTunnelCompat ? buildOpenClawCompatBody(body) : body;

    if (chatSettings.contextRelayEnabled && sessionId && contextRelayKey) {
      const handoff = await loadContextHandoff(sessionId, contextRelayKey);
      if (handoff?.summary && handoff.fromAccount && handoff.fromAccount !== credentials.connectionId) {
        requestBody = injectHandoffIntoBody(requestBody, handoff);
        log.info("CHAT", `Injected context handoff for session ${sessionId} on ${contextRelayKey}`);
      }
    }

    const executeChatCore = async (nextRequestBody) => handleChatCore({
      body: { ...nextRequestBody, model: `${provider}/${model}` },
      modelInfo: { provider, model },
      credentials: refreshedCredentials,
      log,
      clientRawRequest,
      connectionId: credentials.connectionId,
      userAgent,
      apiKey,
      ccFilterNaming: !!chatSettings.ccFilterNaming,
      rtkEnabled: !!chatSettings.rtkEnabled,
      cavemanEnabled: !!chatSettings.cavemanEnabled,
      cavemanLevel: chatSettings.cavemanLevel || "full",
      ponytailEnabled: !!chatSettings.ponytailEnabled,
      ponytailLevel: chatSettings.ponytailLevel || "full",
      headroomEnabled: !!chatSettings.headroomEnabled,
      headroomUrl: chatSettings.headroomUrl || undefined,
      guardMode: chatSettings.promptInjectionGuard || "off",
      payloadRules: Array.isArray(chatSettings.payloadRules) ? chatSettings.payloadRules : undefined,
      providerThinking,
      // Detect source format by endpoint + body
      sourceFormatOverride: request?.url ? detectFormatByEndpoint(new URL(request.url).pathname, nextRequestBody) : null,
      onCredentialsRefreshed: async (newCreds) => {
        await updateProviderCredentials(credentials.connectionId, {
          accessToken: newCreds.accessToken,
          refreshToken: newCreds.refreshToken,
          providerSpecificData: newCreds.providerSpecificData,
          testStatus: "active"
        });
      },
      onRequestSuccess: async () => {
        await clearAccountError(credentials.connectionId, credentials, model);
        if (clientSessionId) bindSessionToConnection(clientSessionId, provider, credentials.connectionId);
        if (sessionId && contextRelayKey) {
          await clearContextHandoff(sessionId, contextRelayKey);
        }
      }
    });

    const runChatCore = async (nextRequestBody) => {
      if (!shouldDeduplicateRequest(nextRequestBody)) {
        return executeChatCore(nextRequestBody);
      }

      const dedupHash = computeRequestDedupHash(nextRequestBody, provider, model);
      const { result: dedupResult, deduplicated } = await withRequestDedup(
        dedupHash,
        () => executeChatCore(nextRequestBody),
      );
      if (deduplicated) {
        log.info("CHAT", `[${provider}/${model}] reused in-flight request ${dedupHash}`);
      }
      return dedupResult;
    };

    let result = await runChatCore(requestBody);

    if (!result.success && [HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.FORBIDDEN, HTTP_STATUS.BAD_GATEWAY].includes(result.status)) {
      const mergedBody = mergeSystemIntoFirstUserMessage(requestBody);
      if (mergedBody) {
        log.warn("CHAT", `[${provider}/${model}] retrying with merged system prompt after upstream ${result.status}`);
        result = await runChatCore(mergedBody);
      }
    }

    if (!result.success && result.status === HTTP_STATUS.FORBIDDEN && options.openClawTunnelCompat) {
      const compactMergedBody = mergeSystemIntoFirstUserMessage(buildOpenClawCompatBody(body));
      if (compactMergedBody) {
        log.warn("CHAT", `[${provider}/${model}] retrying with merged OpenClaw tunnel compatibility payload after upstream 403`);
        result = await runChatCore(compactMergedBody);
      }
    }

    if (result.success) {
      recordProviderSuccess(provider);
      return result.response;
    }

    const alternateModelResponse = await tryAlternateModels({
      body,
      provider,
      model,
      clientRawRequest,
      request,
      apiKey,
      status: result.status,
      errorText: result.error,
    });
    if (alternateModelResponse) return alternateModelResponse;

    if (isBreakerTrippableStatus(result.status)) {
      recordProviderFailure(provider, result.status);
    }

    // Mark account unavailable (auto-calculates cooldown with exponential backoff, or precise resetsAtMs)
    const { shouldFallback } = await markAccountUnavailable(credentials.connectionId, result.status, result.error, provider, model, result.resetsAtMs, credentials);

    if (shouldFallback) {
      if (chatSettings.contextRelayEnabled && sessionId && contextRelayKey) {
        const handoffPayload = buildHandoffPayload({
          body: requestBody,
          sessionId,
          comboName: contextRelayKey,
          fromAccount: credentials.connectionId,
          provider,
          model,
          maxMessages: Number(chatSettings.contextRelayMaxMessages) || 16,
        });
        if (handoffPayload) {
          await storeContextHandoff(handoffPayload);
          log.info("CHAT", `Stored context handoff for session ${sessionId} on ${contextRelayKey}`);
        }
      }
      log.warn("AUTH", `Account ${credentials.connectionName} unavailable (${result.status}), trying fallback`);
      excludeConnectionIds.add(credentials.connectionId);
      lastError = result.error;
      lastStatus = result.status;
      continue;
    }

    return result.response;
  }
}
