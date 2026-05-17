import { NextResponse } from "next/server";
import { killAppProcesses } from "@/lib/appUpdater";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, message: "Not allowed in production" }, { status: 403 });
  }

  try {
    await killAppProcesses();
  } catch {}

  const response = NextResponse.json({ success: true, message: "Shutting down..." });

  setTimeout(() => {
    process.exit(0);
  }, 500);

  return response;
}
