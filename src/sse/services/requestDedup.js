import { createHash } from "node:crypto";

const DEFAULT_CONFIG = {
  enabled: true,
  maxTemperature: 0.15,
  timeoutMs: 30_000,
};

const inflight = new Map();

function getTemperature(body) {
  return typeof body?.temperature === "number" ? body.temperature : 1;
}

export function shouldDeduplicateRequest(body, config = DEFAULT_CONFIG) {
  if (!config.enabled) return false;
  if (!body || body.stream === true) return false;
  if (getTemperature(body) > config.maxTemperature) return false;
  return true;
}

export function computeRequestDedupHash(body, provider, model) {
  const canonical = {
    provider: provider || null,
    model: model || null,
    messages: body?.messages ?? null,
    input: body?.input ?? null,
    temperature: getTemperature(body),
    top_p: body?.top_p ?? null,
    max_tokens: body?.max_tokens ?? null,
    reasoning_effort: body?.reasoning_effort ?? body?.reasoning?.effort ?? null,
    tools: body?.tools ?? null,
    tool_choice: body?.tool_choice ?? null,
    response_format: body?.response_format ?? null,
  };

  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 24);
}

async function snapshotResult(result) {
  if (!result?.response) return result;
  const responseText = await result.response.text();
  return {
    ...result,
    responseSnapshot: {
      body: responseText,
      status: result.response.status,
      headers: Array.from(result.response.headers.entries()),
    },
    response: undefined,
  };
}

function hydrateResult(snapshot) {
  if (!snapshot?.responseSnapshot) return snapshot;
  return {
    ...snapshot,
    response: new Response(snapshot.responseSnapshot.body, {
      status: snapshot.responseSnapshot.status,
      headers: snapshot.responseSnapshot.headers,
    }),
  };
}

export async function withRequestDedup(hash, task, config = DEFAULT_CONFIG) {
  const existing = inflight.get(hash);
  if (existing) {
    const shared = await existing;
    return {
      result: hydrateResult(shared),
      deduplicated: true,
      hash,
    };
  }

  const promise = (async () => snapshotResult(await task()))();
  inflight.set(hash, promise);
  const timer = setTimeout(() => {
    if (inflight.get(hash) === promise) inflight.delete(hash);
  }, config.timeoutMs);

  try {
    const snapshot = await promise;
    return {
      result: hydrateResult(snapshot),
      deduplicated: false,
      hash,
    };
  } finally {
    clearTimeout(timer);
    if (inflight.get(hash) === promise) inflight.delete(hash);
  }
}

export function getInflightDedupCount() {
  return inflight.size;
}

export function clearInflightDedup() {
  inflight.clear();
}
