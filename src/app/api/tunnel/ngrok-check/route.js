import os from "os";
import { execSync } from "child_process";
import { NextResponse } from "next/server";

function isNgrokInstalled() {
  try {
    if (os.platform() === "win32") {
      execSync("where ngrok", { stdio: "ignore", windowsHide: true, timeout: 3000 });
    } else {
      execSync("which ngrok", { stdio: "ignore", windowsHide: true, timeout: 3000 });
    }
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const platform = os.platform();
    return NextResponse.json({ installed: isNgrokInstalled(), platform });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

