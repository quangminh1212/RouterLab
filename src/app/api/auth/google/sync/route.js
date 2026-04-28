import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createBackupBundle, restoreBackupBundle } from "@/lib/backupBundle";
import { getValidGoogleAccessToken, findDriveBackupFile, uploadDriveBackup, downloadDriveBackup } from "@/lib/googleDriveSync";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "xlabrouter-default-secret-change-me"
);

async function hasValidAuth(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    if (!await hasValidAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action === "restore" ? "restore" : "backup";
    const { accessToken, email } = await getValidGoogleAccessToken();
    const file = await findDriveBackupFile(accessToken);

    if (action === "restore") {
      if (!file?.id) return NextResponse.json({ error: "No Google Drive backup found" }, { status: 404 });
      const payload = await downloadDriveBackup(accessToken, file.id);
      const result = await restoreBackupBundle(payload);
      return NextResponse.json({ ...result, action, email, backup: file });
    }

    const payload = await createBackupBundle();
    const uploaded = await uploadDriveBackup(accessToken, payload, file?.id || "");
    return NextResponse.json({ success: true, action, email, backup: uploaded });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Google Drive sync failed" }, { status: 400 });
  }
}
