import { NextResponse } from "next/server";
import { getApiKeys, getProviderNodes } from "@/lib/localDb";
import { getModelInfo } from "@/sse/services/model";

// POST /api/models/test - Ping a single model via internal completions or embeddings
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { model, kind } = body;
    if (!model) return NextResponse.json({ error: "Model required" }, { status: 400 });

    const configured = process.env.INTERNAL_BASE_URL || process.env.XLABROUTER_INTERNAL_BASE_URL;
    const baseUrl = configured
      ? String(configured).trim().replace(/\/+$/, "")
      : (() => {
        const u = new URL(request.url);
        const port = process.env.PORT || u.port || "1212";
        return `http://127.0.0.1:${port}`;
      })();

    // Get an active internal API key for auth (if requireApiKey is enabled)
    let apiKey = null;
    try {
      const keys = await getApiKeys();
      apiKey = keys.find((k) => k.isActive !== false)?.key || null;
    } catch {}

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const start = Date.now();

    let resolvedModel = model;
    let targetEndpoint = "/api/v1/chat/completions";
    let requestBody = {
      model: resolvedModel,
      max_tokens: 1,
      stream: false,
      messages: [{ role: "user", content: "hi" }],
    };

    try {
      const modelInfo = await getModelInfo(model);
      if (modelInfo?.provider && modelInfo?.model) {
        resolvedModel = `${modelInfo.provider}/${modelInfo.model}`;
        requestBody = {
          model: resolvedModel,
          max_tokens: 1,
          stream: false,
          messages: [{ role: "user", content: "hi" }],
        };
        const providerNodes = await getProviderNodes();
        const matchedNode = providerNodes.find((node) => node.id === modelInfo.provider);
        if (matchedNode?.type === "openai-compatible" && matchedNode?.apiType === "responses") {
          targetEndpoint = "/api/v1/responses";
          requestBody = {
            model: resolvedModel,
            input: "hi",
            max_output_tokens: 1,
            stream: false,
          };
        }
      }
    } catch {}

    // Route to appropriate endpoint based on kind
    if (kind === "embedding") {
      const res = await fetch(`${baseUrl}/api/v1/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, input: "test" }),
        signal: AbortSignal.timeout(45000),
      });
      const latencyMs = Date.now() - start;
      const rawText = await res.text().catch(() => "");
      let parsed = null;
      try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}

      if (!res.ok) {
        const detail = parsed?.error?.message || parsed?.error || rawText;
        return NextResponse.json({ ok: false, latencyMs, error: `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`, status: res.status });
      }
      const hasEmbedding = Array.isArray(parsed?.data) && parsed.data.length > 0 && Array.isArray(parsed.data[0]?.embedding);
      if (!hasEmbedding) {
        return NextResponse.json({ ok: false, latencyMs, status: res.status, error: "Provider returned no embedding data" });
      }
      return NextResponse.json({ ok: true, latencyMs, error: null, status: res.status });
    }

    const res = await fetch(`${baseUrl}${targetEndpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(45000),
    });
    const latencyMs = Date.now() - start;

    const rawText = await res.text().catch(() => "");
    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (!res.ok) {
      const detail = parsed?.error?.message || parsed?.msg || parsed?.message || parsed?.error || rawText;
      const error = `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`;
      return NextResponse.json({ ok: false, latencyMs, error, status: res.status });
    }

    // Some providers may return HTTP 200 but not a real completion for invalid models.
    const providerStatus = parsed?.status;
    const providerMsg = parsed?.msg || parsed?.message;
    const hasProviderErrorStatus = providerStatus !== undefined
      && providerStatus !== null
      && String(providerStatus) !== "200"
      && String(providerStatus) !== "0";
    if (hasProviderErrorStatus && providerMsg) {
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error: `Provider status ${providerStatus}: ${String(providerMsg).slice(0, 240)}`,
      });
    }

    if (parsed?.error) {
      const providerError = parsed?.error?.message || parsed?.error || "Provider returned an error";
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error: String(providerError).slice(0, 240),
      });
    }

    const hasChoices = (Array.isArray(parsed?.choices) && parsed.choices.length > 0) || (Array.isArray(parsed?.output) && parsed.output.length > 0) || parsed?.status === "completed" || parsed?.object === "response";
    if (!hasChoices) {
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error: "Provider returned no completion choices for this model",
      });
    }

    return NextResponse.json({ ok: true, latencyMs, error: null, status: res.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

