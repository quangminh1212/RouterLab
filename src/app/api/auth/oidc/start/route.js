/**
 * 9router OIDC start — enable when OIDC_ISSUER + OIDC_CLIENT_ID set.
 */
export async function GET(request) {
  const issuer = process.env.OIDC_ISSUER || process.env.AUTH_OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID || process.env.AUTH_OIDC_CLIENT_ID;
  if (!issuer || !clientId) {
    return Response.json(
      {
        error: {
          message:
            "OIDC not configured. Set OIDC_ISSUER and OIDC_CLIENT_ID (optional OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI).",
          type: "not_configured",
        },
      },
      { status: 501 }
    );
  }
  const url = new URL(request.url);
  const redirectUri =
    process.env.OIDC_REDIRECT_URI ||
    `${url.origin}/api/auth/oidc/callback`;
  const state = crypto.randomUUID?.() || String(Date.now());
  const authUrl = new URL(
    issuer.replace(/\/$/, "") +
      (issuer.includes("/authorize") ? "" : "/authorize")
  );
  // If issuer is base, use standard authorize path
  let authorize = issuer.replace(/\/$/, "");
  if (!/authorize/i.test(authorize)) authorize += "/authorize";
  const dest = new URL(authorize);
  dest.searchParams.set("client_id", clientId);
  dest.searchParams.set("response_type", "code");
  dest.searchParams.set("scope", process.env.OIDC_SCOPE || "openid profile email");
  dest.searchParams.set("redirect_uri", redirectUri);
  dest.searchParams.set("state", state);

  return Response.redirect(dest.toString(), 302);
}
