/**
 * 9router parity: POST /api/oauth/kiro/import-cli-proxy
 * Import Kiro credentials from CLIProxyAPI auth files.
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return Response.json({
    success: false,
    message:
      "Import Kiro auth from CLIProxyAPI by pointing provider cliproxyapi baseUrl " +
      "or paste tokens via dashboard. Optional body.authDir=" +
      (body?.authDir || process.env.CLIPROXY_AUTH_DIR || "~/.cli-proxy-api"),
  });
}
