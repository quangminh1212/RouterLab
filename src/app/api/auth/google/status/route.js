import { NextResponse } from "next/server";
import { getGoogleSession, isGoogleAuthConfigured, getValidGoogleAccessToken, findDriveBackupFile, buildGoogleRedirectUri, getGoogleAuthConfig } from "@/lib/googleDriveSync";

export async function GET(request) {
  try {
    const session = await getGoogleSession();
    const authConfig = getGoogleAuthConfig();
    let backup = null;
    if (session.email && session.refreshToken) {
      try {
        const { accessToken } = await getValidGoogleAccessToken();
        backup = await findDriveBackupFile(accessToken);
      } catch {}
    }
    return NextResponse.json({
      configured: isGoogleAuthConfigured(),
      authSource: authConfig.source || "none",
      expectedRedirectUri: buildGoogleRedirectUri(request),
      connected: !!session.email && !!session.refreshToken,
      email: session.email || "",
      backup,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load Google sync status" }, { status: 500 });
  }
}
