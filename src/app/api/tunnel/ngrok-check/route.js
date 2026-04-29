import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { NextResponse } from "next/server";

function getManagedNgrokPath() {
  if (os.platform() === "win32") {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
    return path.join(home, ".xlabrouter", "bin", "ngrok.exe");
  }
  const home = process.env.HOME || os.homedir();
  return path.join(home, ".xlabrouter", "bin", "ngrok");
}

function isNgrokInstalled() {
  try {
    const managedPath = getManagedNgrokPath();
    if (fs.existsSync(managedPath)) return true;

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
    const managedPath = getManagedNgrokPath();
    return NextResponse.json({ installed: isNgrokInstalled(), platform, managedPath, managedExists: fs.existsSync(managedPath) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
