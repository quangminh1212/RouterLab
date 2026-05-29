import { NextResponse } from "next/server";

const DEFAULT_TIMEOUT_MS = 8000;

function normalizeEndpoint(endpoint) {
  if (typeof endpoint !== "string") return "";
  return endpoint.trim();
}

function buildHeaders(apiKey) {
  const headers = { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function withJsonHeaders(apiKey) {
  return { ...buildHeaders(apiKey), "Content-Type": "application/json" };
}

function buildCandidateUrls(targetUrl) {
  const original = targetUrl.toString().replace(/\/$/, "");
  const pathname = targetUrl.pathname.replace(/\/$/, "");
  const candidates = [];
  const push = (url, method, body, label) => candidates.push({ url, method, body, label });

  if (/\/responses$/i.test(pathname)) {
    push(original, "POST", { model: "gpt-4o-mini", input: "ping", max_output_tokens: 1, stream: false }, "responses");
    push(`${original.replace(/\/responses$/i, "")}/models`, "GET", null, "models");
    return candidates;
  }
  if (/\/chat\/completions$/i.test(pathname)) {
    push(original, "POST", { model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 1, stream: false }, "chat.completions");
    push(`${original.replace(/\/chat\/completions$/i, "")}/models`, "GET", null, "models");
    return candidates;
  }
  if (/\/v1$/i.test(pathname)) {
    push(`${original}/models`, "GET", null, "models");
    push(`${original}/chat/completions`, "POST", { model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 1, stream: false }, "chat.completions");
    push(`${original}/responses`, "POST", { model: "gpt-4o-mini", input: "ping", max_output_tokens: 1, stream: false }, "responses");
    return candidates;
  }
  push(`${original}/models`, "GET", null, "models");
  push(`${original}/v1/models`, "GET", null, "v1/models");
  push(`${original}/chat/completions`, "POST", { model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 1, stream: false }, "chat.completions");
  push(`${original}/v1/chat/completions`, "POST", { model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 1, stream: false }, "v1/chat.completions");
  return candidates;
}

async function runCandidate(candidate, apiKey, signal) {
  const headers = candidate.method === "POST" ? withJsonHeaders(apiKey) : buildHeaders(apiKey);
  const response = await fetch(candidate.url, {
    method: candidate.method,
    headers,
    body: candidate.body ? JSON.stringify(candidate.body) : undefined,
    signal,
    cache: "no-store",
  });
  const authRejected = Boolean(apiKey) && (response.status === 401 || response.status === 403);
  const ok = response.ok && !authRejected;
  return { ok, status: response.status, statusText: response.statusText, authRejected };
}

export async function POST(request) {
  const startedAt = Date.now();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const endpoint = normalizeEndpoint(body?.endpoint);
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

    if (!endpoint) return NextResponse.json({ ok: false, error: "Endpoint is required" }, { status: 400 });

    let targetUrl;
    try { targetUrl = new URL(endpoint); }
    catch { return NextResponse.json({ ok: false, error: "Endpoint URL is invalid" }, { status: 400 }); }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const candidates = buildCandidateUrls(targetUrl);
      const attempts = [];
      for (const candidate of candidates) {
        try {
          const result = await runCandidate(candidate, apiKey, controller.signal);
          attempts.push({ endpoint: candidate.url, method: candidate.method, label: candidate.label, status: result.status, statusText: result.statusText });
          if (result.ok) {
            return NextResponse.json({ ok: true, status: result.status, statusText: result.statusText, endpoint: candidate.url, method: candidate.method, attempts, error: null, elapsedMs: Date.now() - startedAt }, { status: 200 });
          }
          if (result.authRejected) {
            return NextResponse.json({ ok: false, status: result.status, statusText: result.statusText, endpoint: candidate.url, method: candidate.method, attempts, error: "Authentication rejected", elapsedMs: Date.now() - startedAt }, { status: 502 });
          }
        } catch (candidateError) {
          attempts.push({ endpoint: candidate.url, method: candidate.method, label: candidate.label, error: candidateError?.name === "AbortError" ? "Connection timed out" : (candidateError?.message || "Connection failed") });
        }
      }

      const lastAttempt = attempts[attempts.length - 1] || null;
      const error = lastAttempt?.status ? `Endpoint returned ${lastAttempt.status}` : (lastAttempt?.error || "Connection failed");
      return NextResponse.json({ ok: false, status: lastAttempt?.status || 0, statusText: lastAttempt?.statusText || "", endpoint: lastAttempt?.endpoint || endpoint, method: lastAttempt?.method || "GET", attempts, error, elapsedMs: Date.now() - startedAt }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message = err?.name === "AbortError" ? "Connection timed out" : (err?.message || "Connection failed");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
