import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  findDriveBackupFile,
  downloadDriveBackup,
  setGoogleSession,
  uploadDriveBackup,
  hasMeaningfulBackupData,
} from "@/lib/googleDriveSync";
import { createBackupBundle, restoreBackupBundle } from "@/lib/backupBundle";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "xlabrouter-default-secret-change-me"
);
const AUTH_SESSION_MAX_AGE_SECONDS = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || 60 * 60 * 24 * 90);

async function setAuthCookie(email) {
  const token = await new SignJWT({ authenticated: true, email, provider: "google" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${AUTH_SESSION_MAX_AGE_SECONDS}s`)
    .sign(SECRET);
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error") || "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value || "";
  cookieStore.delete("google_oauth_state");

  if (error) return NextResponse.redirect(new URL(`/login?google=${encodeURIComponent(error)}`, request.url));
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?google=invalid-state", request.url));
  }

  try {
    const tokenData = await exchangeGoogleCode(request, code);
    const profile = await fetchGoogleProfile(tokenData.access_token);
    const email = typeof profile?.email === "string" ? profile.email : "";
    if (!email) throw new Error("Google account email not found");

    const expiresAt = Date.now() + (Number(tokenData.expires_in || 3600) * 1000);
    await setGoogleSession({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || "",
      email,
      expiresAt,
    });
    await setAuthCookie(email);

    let syncStatus = "connected";
    const remoteFile = await findDriveBackupFile(tokenData.access_token);
    if (remoteFile?.id) {
      const remoteBackup = await downloadDriveBackup(tokenData.access_token, remoteFile.id);
      await restoreBackupBundle(remoteBackup);
      syncStatus = "restored";
    } else {
      const localBackup = await createBackupBundle();
      if (hasMeaningfulBackupData(localBackup)) {
        await uploadDriveBackup(tokenData.access_token, localBackup);
        syncStatus = "backed-up";
      }
    }

    return NextResponse.redirect(new URL(`/dashboard/profile?google=${syncStatus}`, request.url));
  } catch (err) {
    return NextResponse.redirect(new URL(`/login?google=${encodeURIComponent(err.message || "google-login-failed")}`, request.url));
  }
}
