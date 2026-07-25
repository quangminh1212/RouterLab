/**
 * 9router parity: proxy to local Headroom server.
 * Forwards /api/headroom/proxy/* → HEADROOM_URL origin.
 */
import { getSettings } from "@/lib/localDb";

const DEFAULT_ORIGIN = "http://localhost:8787";

async function resolveOrigin() {
  const settings = await getSettings().catch(() => ({}));
  const url = settings?.headroomUrl || process.env.HEADROOM_URL || `${DEFAULT_ORIGIN}/v1/compress`;
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

async function proxy(request, { params }) {
  const resolved = await params;
  const segs = Array.isArray(resolved?.path) ? resolved.path.join("/") : resolved?.path || "";
  const origin = await resolveOrigin();
  const target = new URL(request.url);
  const dest = `${origin}/${segs}${target.search}`;

  let body = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }
  try {
    const res = await fetch(dest, {
      method: request.method,
      headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
      body: body && body.byteLength ? body : undefined,
      duplex: body && body.byteLength ? "half" : undefined,
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return Response.json(
      { error: { message: `Headroom proxy failed: ${err.message}`, type: "proxy_error" } },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
