"use server";

import { NextResponse } from "next/server";
import { getCachedPassword, loadEncryptedPassword, initDbHooks } from "@/mitm/manager";
import { getSettings, updateSettings } from "@/lib/localDb";

initDbHooks(getSettings, updateSettings);

export async function POST(request) {
  try {
    const { startDaemonWithPassword } = await import("@/lib/tunnel/tailscale");
    const body = await request.json().catch(() => ({}));
    const password = body.sudoPassword || getCachedPassword() || await loadEncryptedPassword() || "";
    await startDaemonWithPassword(password);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tailscale start daemon error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}