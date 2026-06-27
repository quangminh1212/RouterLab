import { createErrorResult, parseUpstreamError, formatProviderError } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";
import { getMusicAdapter } from "./musicProviders/index.js";
import { generateTaskId, nowSec } from "./musicProviders/_base.js";

export const musicTaskStore = globalThis.__musicTaskStore || (globalThis.__musicTaskStore = new Map());

/**
 * Core music generation handler.
 *
 * @param {object} options
 * @param {object} options.body - Request body { model, prompt, duration, style, instrumental, wait_for_completion, poll_interval_ms, max_poll_time_ms }
 * @param {object} options.modelInfo - { provider, model }
 * @param {object} options.credentials - Provider credentials
 * @param {object} [options.log] - Logger
 * @param {function} [options.onRequestSuccess]
 * @returns {Promise<{ success: boolean, response: Response, status?: number, error?: string }>}
 */
export async function handleMusicCore({ body, modelInfo, credentials, log, onRequestSuccess }) {
  const { provider, model } = modelInfo;

  if (!body.prompt) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required field: prompt");
  }

  const adapter = getMusicAdapter(provider);
  if (!adapter) {
    return createErrorResult(
      HTTP_STATUS.BAD_REQUEST,
      `Provider '${provider}' does not support music generation`
    );
  }

  const url = adapter.buildUrl(model, credentials);
  const headers = adapter.buildHeaders(credentials);
  const requestBody = adapter.buildBody(model, body);
  const waitForCompletion = body.wait_for_completion !== false;
  const pollIntervalMs = body.poll_interval_ms || undefined;
  const maxPollTimeMs = body.max_poll_time_ms || undefined;

  log?.debug?.("MUSIC", `${provider.toUpperCase()} | ${model} | prompt="${body.prompt.slice(0, 50)}..."`);

  let providerResponse;
  try {
    providerResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    const errMsg = formatProviderError(error, provider, model, HTTP_STATUS.BAD_GATEWAY);
    log?.debug?.("MUSIC", `Fetch error: ${errMsg}`);
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, errMsg);
  }

  if (!providerResponse.ok) {
    const { statusCode, message, resetsAtMs } = await parseUpstreamError(providerResponse);
    const errMsg = formatProviderError(new Error(message), provider, model, statusCode);
    log?.debug?.("MUSIC", `Provider error: ${errMsg}`);
    return createErrorResult(statusCode, errMsg, resetsAtMs);
  }

  let submitData;
  try {
    submitData = await providerResponse.json();
  } catch (parseError) {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, parseError.message || `Invalid response from ${provider}`);
  }

  let taskId;
  try {
    taskId = adapter.parseSubmit(submitData);
  } catch (err) {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, err.message || `Failed to parse task id from ${provider}`);
  }

  const internalId = generateTaskId();

  if (!waitForCompletion) {
    musicTaskStore.set(internalId, {
      id: internalId,
      providerTaskId: taskId,
      provider,
      model,
      status: "pending",
      createdAt: nowSec(),
      credentials,
      pollIntervalMs,
      maxPollTimeMs,
      adapter,
    });

    return {
      success: true,
      response: new Response(
        JSON.stringify({
          id: internalId,
          object: "audio.music.task",
          status: "pending",
          poll_url: `/v1/audio/music/tasks/${internalId}`,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ),
    };
  }

  let clip;
  try {
    clip = await adapter.poll(taskId, headers, { pollIntervalMs, maxPollTimeMs });
  } catch (err) {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, err.message || `${provider} polling failed`);
  }

  if (onRequestSuccess) await onRequestSuccess();

  const normalized = adapter.normalize(clip, provider);

  return {
    success: true,
    response: new Response(
      JSON.stringify({
        id: internalId,
        object: "audio.music",
        created: nowSec(),
        data: [normalized],
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    ),
  };
}
