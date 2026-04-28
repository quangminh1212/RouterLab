import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildGoogleAuthUrl, isGoogleAuthConfigured } from "@/lib/googleDriveSync";

export async function GET(request) {
  if (!isGoogleAuthConfigured()) {
    const fallback = new URL("/login?google=not-configured", request.url);
    return NextResponse.redirect(fallback);
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(request, state));
}
