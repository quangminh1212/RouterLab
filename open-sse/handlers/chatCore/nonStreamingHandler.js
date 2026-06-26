import { FORMATS } from "../../translator/formats.js";
import { needsTranslation } from "../../translator/index.js";
import { ollamaBodyToOpenAI } from "../../translator/response/ollama-to-openai.js";
import { addBufferToUsage, filterUsageForFormat } from "../../utils/usageTracking.js";
import { createErrorResult } from "../../utils/error.js";
import { HTTP_STATUS } from "../../config/runtimeConfig.js";
import { parseSSEToOpenAIResponse } from "./sseToJsonHandler.js";
import { convertResponsesStreamToJson } from "../../transformer/streamToJsonConverter.js";
import { buildRequestDetail, extractRequestConfig, extractUsageFromResponse, saveUsageStats } from "./requestDetail.js";
import { appendRequestLog, saveRequestDetail } from "@/lib/usageDb.js";
import { decloakToolNames } from "../../utils/claudeCloaking.js";

function streamFromText(text) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(String(text || "")));
      controller.close();
    },
  });
}

function looksLikeSSE(text) {
  const raw = String(text || "").trim();
  return raw.startsWith("event:") || raw.startsWith("data:") || raw.includes("\nevent:") || raw.includes("\ndata:");
}

function looksLikeResponsesSSE(text) {
  const raw = String(text || "");
  return /(^|\n)event:\s*response\./i.test(raw)
    || /(^|\n)data:\s*\{[^\n]*("type"\s*:\s*"response\.|"object"\s*:\s*"response"|"response"\s*:)/i.test(raw);
}

function responsesBodyToOpenAIChatCompletion(responseBody, fallbackModel) {
  const output = Array.isArray(responseBody?.output) ? responseBody.output : [];
  const messageItems = output.filter((item) => item?.type === "message");
  let textContent = "";

  for (let i = messageItems.length - 1; i >= 0; i--) {
    const content = Array.isArray(messageItems[i]?.content) ? messageItems[i].content : [];
    const text = content
      .map((part) => typeof part?.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("");
    if (text) {
      textContent = text;
      break;
    }
  }

  const functionCalls = output.filter((item) => item?.type === "function_call");
  const toolCalls = functionCalls.map((item, index) => ({
    id: item.call_id || `call_${item.name || "tool"}_${Date.now()}_${index}`,
    type: "function",
    function: {
      name: item.name || "tool",
      arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments || {})
    }
  }));

  const usage = responseBody?.usage || {};
  const message = { role: "assistant", content: textContent || (toolCalls.length ? null : "") };
  if (toolCalls.length) message.tool_calls = toolCalls;

  return {
    id: responseBody?.id || `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: responseBody?.created_at || Math.floor(Date.now() / 1000),
    model: responseBody?.model || fallbackModel || "unknown",
    choices: [{
      index: 0,
      message,
      finish_reason: toolCalls.length ? "tool_calls" : (responseBody?.status === "completed" ? "stop" : (responseBody?.status || "stop"))
    }],
    usage: {
      prompt_tokens: usage.input_tokens || 0,
      completion_tokens: usage.output_tokens || 0,
      total_tokens: usage.total_tokens || ((usage.input_tokens || 0) + (usage.output_tokens || 0))
    }
  };
}

async function parseSSEForNonStreaming(rawText, sourceFormat, model) {
  try {
    const responsesBody = await convertResponsesStreamToJson(streamFromText(rawText));
    const hasResponsesShape = responsesBody && (
      responsesBody.object === "response"
      || Array.isArray(responsesBody.output)
      || typeof responsesBody.status === "string"
    );
    if (hasResponsesShape && (sourceFormat === FORMATS.OPENAI_RESPONSES || looksLikeResponsesSSE(rawText) || responsesBody.output?.length || responsesBody.usage)) {
      return sourceFormat === FORMATS.OPENAI_RESPONSES
        ? responsesBody
        : responsesBodyToOpenAIChatCompletion(responsesBody, model);
    }
  } catch {
    // Fall through to generic chat SSE parser
  }
  return parseSSEToOpenAIResponse(rawText, model);
}
/**
 * Translate non-streaming response body from provider format -> OpenAI format.
 */
export function translateNonStreamingResponse(responseBody, targetFormat, sourceFormat) {
  if (targetFormat === sourceFormat || targetFormat === FORMATS.OPENAI) return responseBody;

  // Gemini / Antigravity
  if (targetFormat === FORMATS.GEMINI || targetFormat === FORMATS.ANTIGRAVITY || targetFormat === FORMATS.GEMINI_CLI || targetFormat === FORMATS.VERTEX) {
    const response = responseBody.response || responseBody;
    if (!response?.candidates?.[0]) return responseBody;

    const candidate = response.candidates[0];
    const content = candidate.content;
    const usage = response.usageMetadata || responseBody.usageMetadata;
    let textContent = "", reasoningContent = "";
    const toolCalls = [];

    if (content?.parts) {
      for (const part of content.parts) {
        if (part.thought === true && part.text) reasoningContent += part.text;
        else if (part.text !== undefined) textContent += part.text;
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${part.functionCall.name}_${Date.now()}_${toolCalls.length}`,
            type: "function",
            function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) }
          });
        }
      }
    }

    const message = { role: "assistant" };
    if (textContent) message.content = textContent;
    if (reasoningContent) message.reasoning_content = reasoningContent;
    if (toolCalls.length > 0) message.tool_calls = toolCalls;
    if (!message.content && !message.tool_calls) message.content = "";

    let finishReason = (candidate.finishReason || "stop").toLowerCase();
    if (finishReason === "stop" && toolCalls.length > 0) finishReason = "tool_calls";

    const result = {
      id: `chatcmpl-${response.responseId || Date.now()}`,
      object: "chat.completion",
      created: Math.floor(new Date(response.createTime || Date.now()).getTime() / 1000),
      model: response.modelVersion || "gemini",
      choices: [{ index: 0, message, finish_reason: finishReason }]
    };

    if (usage) {
      result.usage = {
        prompt_tokens: (usage.promptTokenCount || 0) + (usage.thoughtsTokenCount || 0),
        completion_tokens: usage.candidatesTokenCount || 0,
        total_tokens: usage.totalTokenCount || 0
      };
      if (usage.thoughtsTokenCount > 0) {
        result.usage.completion_tokens_details = { reasoning_tokens: usage.thoughtsTokenCount };
      }
    }
    return result;
  }

  // Claude
  if (targetFormat === FORMATS.CLAUDE) {
    if (!responseBody.content) return responseBody;

    let textContent = "", thinkingContent = "";
    const toolCalls = [];

    for (const block of responseBody.content) {
      if (block.type === "text") {
        // Strip markdown code block markers (e.g. kimi wraps JSON in ```json...```)
        const raw = block.text ?? "";
        const text = raw.replace(/^\s*```\s*json\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");
        textContent += text;
      } else if (block.type === "thinking") thinkingContent += block.thinking || "";
      else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input || {}) } });
      }
    }

    const message = { role: "assistant" };
    if (textContent) message.content = textContent;
    if (thinkingContent) message.reasoning_content = thinkingContent;
    if (toolCalls.length > 0) message.tool_calls = toolCalls;
    if (!message.content && !message.tool_calls) message.content = "";

    let finishReason = responseBody.stop_reason || "stop";
    if (finishReason === "end_turn") finishReason = "stop";
    if (finishReason === "tool_use") finishReason = "tool_calls";

    const result = {
      id: `chatcmpl-${responseBody.id || Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: responseBody.model || "claude",
      choices: [{ index: 0, message, finish_reason: finishReason }]
    };

    if (responseBody.usage) {
      result.usage = {
        prompt_tokens: responseBody.usage.input_tokens || 0,
        completion_tokens: responseBody.usage.output_tokens || 0,
        total_tokens: (responseBody.usage.input_tokens || 0) + (responseBody.usage.output_tokens || 0)
      };
    }
    return result;
  }

  // Ollama
  if (targetFormat === FORMATS.OLLAMA) {
    return ollamaBodyToOpenAI(responseBody);
  }

  return responseBody;
}

/**
 * Handle non-streaming response from provider.
 */
export async function handleNonStreamingResponse({ providerResponse, provider, model, sourceFormat, targetFormat, body, stream, translatedBody, finalBody, requestStartTime, connectionId, apiKey, clientRawRequest, onRequestSuccess, reqLogger, toolNameMap, trackDone, appendLog, rtkStats }) {
  trackDone();
  const contentType = providerResponse.headers.get("content-type") || "";
  let responseBody;

  if (contentType.includes("text/event-stream")) {
    const sseText = await providerResponse.text();
    responseBody = await parseSSEForNonStreaming(sseText, sourceFormat, model);
    if (!responseBody) {
      appendLog({ status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}` });
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "Invalid SSE response for non-streaming request");
    }
  } else {
    const rawText = await providerResponse.text();
    try {
      responseBody = rawText ? JSON.parse(rawText) : {};
    } catch (err) {
      if (looksLikeSSE(rawText)) {
        try {
          responseBody = await parseSSEForNonStreaming(rawText, sourceFormat, model);
        } catch {
          responseBody = null;
        }
      }
      if (!responseBody) {
        appendLog({ status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}` });
        console.error(`[ChatCore] Failed to parse JSON from ${provider}:`, err.message);
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `Invalid JSON response from ${provider}`);
      }
    }
  }

  reqLogger.logProviderResponse(providerResponse.status, providerResponse.statusText, providerResponse.headers, responseBody);
  if (onRequestSuccess) await onRequestSuccess();

  // Decloak tool_use names once on raw Claude body, before any translation (INPUT side)
  responseBody = decloakToolNames(responseBody, toolNameMap);

  const usage = extractUsageFromResponse(responseBody);
  appendLog({ tokens: usage, status: "200 OK" });
  saveUsageStats({
    provider,
    model,
    tokens: usage,
    connectionId,
    apiKey,
    endpoint: clientRawRequest?.endpoint,
    compression: rtkStats,
    durationMs: Date.now() - requestStartTime,
  });

  const translatedResponse = needsTranslation(targetFormat, sourceFormat)
    ? translateNonStreamingResponse(responseBody, targetFormat, sourceFormat)
    : responseBody;

  // Fix finish_reason for tool_calls: some providers return non-standard values (e.g. "other")
  if (translatedResponse?.choices?.[0]) {
    const choice = translatedResponse.choices[0];
    const msg = choice.message;
    const hasToolCalls = Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0;
    if (hasToolCalls && choice.finish_reason !== "tool_calls") {
      choice.finish_reason = "tool_calls";
    }
  }

  // Ensure OpenAI-required fields
  if (!translatedResponse.object) translatedResponse.object = "chat.completion";
  if (!translatedResponse.created) translatedResponse.created = Math.floor(Date.now() / 1000);

  // Strip Azure-specific fields
  delete translatedResponse.prompt_filter_results;
  if (translatedResponse?.choices) {
    for (const choice of translatedResponse.choices) delete choice.content_filter_results;
  }

  if (translatedResponse?.usage) {
    translatedResponse.usage = filterUsageForFormat(addBufferToUsage(translatedResponse.usage), sourceFormat);
  }

  // Strip reasoning_content - some clients (e.g. Firecrawl AI SDK) have JSON parsers that
  // break on this non-standard field, even though OpenAI allows it in extensions.
  if (translatedResponse?.choices) {
    for (const choice of translatedResponse.choices) {
      if (choice?.message) delete choice.message.reasoning_content;
    }
  }

  reqLogger.logConvertedResponse(translatedResponse);

  const totalLatency = Date.now() - requestStartTime;
  saveRequestDetail(buildRequestDetail({
    provider, model, connectionId,
    latency: { ttft: totalLatency, total: totalLatency },
    tokens: usage || { prompt_tokens: 0, completion_tokens: 0 },
    request: extractRequestConfig(body, stream),
    providerRequest: finalBody || translatedBody || null,
    providerResponse: responseBody || null,
    response: {
      content: translatedResponse?.choices?.[0]?.message?.content || translatedResponse?.content || null,
      thinking: translatedResponse?.choices?.[0]?.message?.reasoning_content || translatedResponse?.reasoning_content || null,
      finish_reason: translatedResponse?.choices?.[0]?.finish_reason || "unknown"
    },
    status: "success"
  }, { endpoint: clientRawRequest?.endpoint || null })).catch(err => {
    console.error("[RequestDetail] Failed to save:", err.message);
  });

  return {
    success: true,
    response: new Response(JSON.stringify(translatedResponse), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  };
}

