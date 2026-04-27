import { NextResponse } from "next/server";
import { getApiKeys } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const baseUrl = process.env.BASE_URL || (() => {
      const u = new URL(request.url);
      return `${u.protocol}//${u.host}`;
    })();

    let apiKey = null;
    try {
      const keys = await getApiKeys();
      apiKey = keys.find((k) => k.isActive !== false)?.key || null;
    } catch {}

    const headers = {
      "Content-Type": "application/json",
      Accept: request.headers.get("Accept") || "application/json",
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
