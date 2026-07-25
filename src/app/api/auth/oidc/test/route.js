/** 9router parity: GET /api/auth/oidc/test */
export async function GET() {
  const issuer = process.env.OIDC_ISSUER || process.env.AUTH_OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID || process.env.AUTH_OIDC_CLIENT_ID;
  return Response.json({
    configured: Boolean(issuer && clientId),
    issuer: issuer || null,
    clientId: clientId ? `${clientId.slice(0, 4)}…` : null,
  });
}
