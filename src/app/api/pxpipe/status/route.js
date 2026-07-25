/** 9router parity: GET /api/pxpipe/status — Cloudflare/Deno proxy pipe manager */
export async function GET() {
  return Response.json({
    running: false,
    managed: false,
    message:
      "PxPipe (cloudflare/deno edge proxy) is optional. Deploy proxy-pools via dashboard or configure PROXY_POOL_*.",
  });
}
