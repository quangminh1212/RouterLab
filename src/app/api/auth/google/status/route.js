import { NextResponse } from "next/server";
import { getGoogleSession, isGoogleAuthConfigured, getValidGoogleAccessToken, findDriveBackupFile, buildGoogleRedirectUri, getGoogleAuthConfig } from "@/lib/googleDriveSync";

const BACKUP_CACHE_TTL_MS = 15_000;
const backupCache = new Map();

export async function GET(request) {
  try {
    const session = await getGoogleSession();
    const authConfig = getGoogleAuthConfig();
    let backup = null;
    if (session.email && session.refreshToken) {
      const cacheKey = session.email;
      const cached = backupCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < BACKUP_CACHE_TTL_MS) {
        backup = cached.data;
      } else {
        try {
          const { accessToken } = await getValidGoogleAccessToken();
          backup = await findDriveBackupFile(accessToken);
          backupCache.set(cacheKey, { data: backup, timestamp: Date.now() });
        } catch {}
      }
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
