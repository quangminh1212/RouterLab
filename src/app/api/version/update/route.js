import { NextResponse } from "next/server";
import { killAppProcesses, spawnUpdaterAndExit } from "@/lib/appUpdater";

export async function POST() {
  const isHostedRuntime = process.env.VERCEL === "1" || process.env.VERCEL === "true";
  if (isHostedRuntime) {
    return NextResponse.json(
      { success: false, message: "Update is not available on hosted runtime" },
      { status: 403 }
    );
  }

  try {
    // Kill sibling processes (cloudflared, MITM, stray next-server) to release file locks on Windows
    await killAppProcesses();
  } catch { /* best effort */ }

  // Schedule detached updater then exit current server process
  spawnUpdaterAndExit();

  return NextResponse.json({ success: true, message: "Updater started. This app will exit shortly." });
}
