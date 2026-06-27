// Cost telemetry headers — appended to non-streaming LLM responses.
// For streaming responses, usage is tracked via onStreamComplete and available
// in the final SSE `[DONE]` event and usage DB.

/**
 * Build cost/usage headers from a parsed response body.
 * @param {object} responseBody - Parsed JSON response (OpenAI or Claude format)
 * @param {object} options - { provider, model, pricing }
 * @returns {Record<string, string>} Headers to add
 */
export function buildCostHeaders(responseBody, options = {}) {
  const headers = {};
  if (!responseBody) return headers;

  const usage = responseBody.usage;
  if (!usage) return headers;

  const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
  const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
  const cacheHitTokens = usage.prompt_tokens_details?.cached_tokens || usage.cache_read_input_tokens || 0;

  if (inputTokens) headers["X-Usage-Input"] = String(inputTokens);
  if (outputTokens) headers["X-Usage-Output"] = String(outputTokens);
  if (cacheHitTokens) headers["X-Usage-Cache-Hit"] = String(cacheHitTokens);

  if (options.provider) headers["X-Provider"] = options.provider;
  if (options.model) headers["X-Model"] = options.model;

  // Calculate cost if pricing available
  const pricing = options.pricing;
  if (pricing && (inputTokens || outputTokens)) {
    const inputCost = (inputTokens / 1_000_000) * (pricing.input || 0);
    const outputCost = (outputTokens / 1_000_000) * (pricing.output || 0);
    const cacheSaved = cacheHitTokens > 0 && pricing.input
      ? (cacheHitTokens / 1_000_000) * (pricing.input - (pricing.cached || pricing.input * 0.5))
      : 0;
    const totalCost = inputCost + outputCost;

    if (totalCost > 0) headers["X-Cost"] = totalCost.toFixed(6);
    if (cacheSaved > 0) headers["X-Cost-Saved"] = cacheSaved.toFixed(6);
  }

  return headers;
}

/**
 * Add cost headers to a Response object (creates new Response with merged headers).
 * @param {Response} response - Original response
 * @param {Record<string, string>} costHeaders - Headers to add
 * @returns {Response} New response with cost headers
 */
export function addCostHeadersToResponse(response, costHeaders) {
  if (!costHeaders || Object.keys(costHeaders).length === 0) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(costHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
