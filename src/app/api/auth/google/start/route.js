import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildGoogleAuthUrl,
  createPkceChallenge,
  createPkceVerifier,
  isGoogleAuthConfigured,
} from "@/lib/googleDriveSync";
import { getSettings } from "@/lib/localDb";

export async function GET(request) {
  if (!isGoogleAuthConfigured()) {
    const fallback = new URL("/login?google=not-configured", request.url);
    return NextResponse.redirect(fallback);
  }

  const reqUrl = new URL(request.url);
  const qrToken = reqUrl.searchParams.get("qr") || "";
  if (qrToken) {
    const settings = await getSettings();
    const currentToken = typeof settings?.oauthQrToken === "string" ? settings.oauthQrToken.trim() : "";
    if (!currentToken || qrToken !== currentToken) {
      const fallback = new URL("/login?google=invalid-qr", request.url);
      return NextResponse.redirect(fallback);
    }
  }

  const state = crypto.randomUUID();
  const codeVerifier = createPkceVerifier();
  const codeChallenge = createPkceChallenge(codeVerifier);
  const cookieStore = await cookies();
  const common = {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  };

  cookieStore.set("google_oauth_state", state, common);
  cookieStore.set("google_oauth_code_verifier", codeVerifier, common);

  return NextResponse.redirect(buildGoogleAuthUrl(request, state, codeChallenge));
}
