import { NextResponse } from "next/server";
import { getApiKeys } from "@/lib/localDb";
import { INTERNAL_REQUEST_HEADER } from "open-sse/config/appConstants.js";

export const dynamic = "force-dynamic";

function getInternalBaseUrl(request) {
  const configured = process.env.INTERNAL_BASE_URL || process.env.XLABROUTER_INTERNAL_BASE_URL;
  if (configured) return String(configured).trim().replace(/\/+$/, "");

  const url = new URL(request.url);
  const port = process.env.PORT || url.port || "1212";
  return `http://127.0.0.1:${port}`;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const baseUrl = getInternalBaseUrl(request);

    let apiKey = null;
    try {
      const keys = await getApiKeys();
      apiKey = keys.find((k) => k.isActive !== false)?.key || null;
    } catch {}

    const headers = {
      "Content-Type": "application/json",
      Accept: request.headers.get("Accept") || "application/json",
      [INTERNAL_REQUEST_HEADER.name]: INTERNAL_REQUEST_HEADER.value,
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const upstream = await fetch(`${baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    const contentType = upstream.headers.get("content-type") || "application/json";

    if (body?.stream && upstream.body) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Dashboard chat proxy failed" }, { status: 500 });
  }
}
