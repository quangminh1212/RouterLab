import { NextResponse } from "next/server";
import { clearGoogleSession } from "@/lib/googleDriveSync";

export async function POST() {
  await clearGoogleSession();
  return NextResponse.json({ success: true });
}
