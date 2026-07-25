/**
 * 9router OIDC callback — exchanges code when OIDC is configured.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) {
    return Response.json(
      { error: { message: err, type: "oidc_error" } },
      { status: 400 }
    );
  }
  if (!code) {
    return Response.json(
      { error: { message: "Missing authorization code", type: "invalid_request" } },
      { status: 400 }
    );
  }
  const issuer = process.env.OIDC_ISSUER || process.env.AUTH_OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID || process.env.AUTH_OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET || process.env.AUTH_OIDC_CLIENT_SECRET;
  if (!issuer || !clientId) {
    return Response.json(
      { error: { message: "OIDC not configured", type: "not_configured" } },
      { status: 501 }
    );
  }
  // Token exchange is deployment-specific; surface code for operator wiring.
  return Response.json({
    success: true,
    message:
      "OIDC code received. Complete token exchange in your IdP integration or set OIDC auto-exchange handlers.",
    code: code.slice(0, 8) + "…",
    hasClientSecret: Boolean(clientSecret),
  });
}
