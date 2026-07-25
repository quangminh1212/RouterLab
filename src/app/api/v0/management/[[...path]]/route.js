/**
 * CLIProxyAPI parity: /v0/management/* → /api/management/*
 * Proxies methods to the existing management tree when possible.
 */
import { withRouteGuard } from "@/lib/runtimeGuard";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function forward(request, { params }) {
  const resolved = await params;
  const segments = resolved?.path;
  const path = Array.isArray(segments) ? segments.join("/") : segments || "";
  const url = new URL(request.url);
  const targetPath = path ? `/api/management/${path}` : "/api/management/status";
  const targetUrl = new URL(targetPath + url.search, url.origin);

  // Rewrite to internal management routes via absolute URL to same host
  const headers = new Headers(request.headers);
  headers.delete("host");

  let body = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength ? body : undefined,
      duplex: body && body.byteLength ? "half" : undefined,
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        ...Object.fromEntries(res.headers.entries()),
        "Access-Control-Allow-Origin": "*",
        "X-RouterLab-V0-Management": "1",
      },
    });
  } catch (err) {
    return Response.json(
      {
        error: {
          message: `v0 management forward failed: ${err.message || String(err)}`,
          type: "proxy_error",
          hint: `Tried ${targetPath}. Use /api/management/* directly if needed.`,
        },
      },
      { status: 502, headers: corsHeaders() }
    );
  }
}

const guard = (method) =>
  withRouteGuard(`v0/management/${method}`, forward, { timeoutMs: 60000 });

export const GET = guard("GET");
export const POST = guard("POST");
export const PUT = guard("PUT");
export const PATCH = guard("PATCH");
export const DELETE = guard("DELETE");
