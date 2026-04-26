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

export async function POST(request) {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const endpoint = normalizeEndpoint(body?.endpoint);
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "Endpoint is required" }, { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(endpoint);
    } catch {
      return NextResponse.json({ ok: false, error: "Endpoint URL is invalid" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(targetUrl, {
        method: "GET",
        headers: buildHeaders(apiKey),
        signal: controller.signal,
        cache: "no-store",
      });

      const authRejected = Boolean(apiKey) && (res.status === 401 || res.status === 403);
      return NextResponse.json({
        ok: res.status < 500 && !authRejected,
        status: res.status,
        statusText: res.statusText,
        elapsedMs: Date.now() - startedAt,
      }, { status: res.status < 500 && !authRejected ? 200 : 502 });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message = err?.name === "AbortError" ? "Connection timed out" : (err?.message || "Connection failed");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
